import { STATUS_CODES } from 'http';
import { accessSync, constants, createReadStream, statSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { posix, resolve } from 'path';
import * as mime from 'mime';

import type { Stats } from 'fs';
import type { Request, Response, NextFunction } from 'express';
import { autoIndexOptions, statFile, serveConfig, save } from './interface';

class autoindex {
	private htmlPage: string;
	private month: string[];
	private savePage: save[];
	private savePageDeadline: number;
	
	options: autoIndexOptions;
	path: string | undefined;
	root: string;

	constructor(root: string, path: string, options: autoIndexOptions | undefined) {
		this.htmlPage = '<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>{{title}}</title></head><body><h1>{{title}}</h1><hr/><table>{{content}}</table><hr/></body><style type="text/css">html{font-family:Arial,Helvetica,sans-serif}table{font-family:\'Courier New\',Courier,monospace;font-size:12px;font-weight:400;letter-spacing:normal;line-height:normal;font-style:normal}tr td:first-child{min-width:20%}td a{margin-right:1em}td.date{text-align:end}</style></html>';
		this.month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		this.savePage = [];
		this.savePageDeadline = 300000; /// 5 * 60 * 1000 => 5min
		
		this.options = {
			cache: options?.cache,
			dirAtTop: options?.dirAtTop ?? true,
			displayDate: options?.displayDate ?? true,
			displayDotfile: options?.displayDotfile ?? false,
			displaySize: options?.displaySize ?? true,
			exclude: options?.exclude,
			json: options?.json ?? false,
			strict: options?.strict ?? true
		};
		this.path = (path.length)
			? path
			: undefined;
		this.root = root;

		if (this.options?.cache && typeof this.options.cache !== 'boolean')
			this.savePageDeadline = this.options.cache;
		if (!root)
			throw new TypeError('root is required');
		accessSync(root, constants.R_OK);
		const dirStat = statSync(root);
		if (!dirStat.isDirectory())
			throw new Error('root is not a directory');
		if (this.path && this.path.charAt(0) !== '/')
			throw new Error(`path '${this.path}' not start with /`);
	}

	error(e: NodeJS.ErrnoException | number) {
		if (typeof e === 'number') 
			return new Error(STATUS_CODES[e]);
		return new Error(e.code === 'ENAMETOOLONG'
			? STATUS_CODES[414]
			: STATUS_CODES[404]);
	}

	parsePath(path: string): string {
		path = posix.normalize(path.normalize());
		if (path.charAt(path.length - 1) === '/' && path.length > 1)
			path = path.slice(0, path.length - 1);
		return path;
	}

	serve(path: string[], res: Response, next: NextFunction) {
		const joinPathForSave = path.join('/');
		if (this.path)
			path.shift();
		const data: serveConfig = {
			path,
			savePath: joinPathForSave,
			serverPath: resolve(this.root, ...path),
			title: (joinPathForSave.length)
				? `/${joinPathForSave}/`
				: '/'
		};
		
		stat(data.serverPath)
			.then((statOfFile) => {
				if (statOfFile.isFile())
					this.file(data, statOfFile, res);
				else if (statOfFile.isDirectory())
					this.directory(data, res, next);
				else
					throw new Error(`${data.title} is not a directory or a file`);
			})
			.catch((e) => {
				next(this.error(e));
			});
	}

	private send(data: string | Record<string, any>, res: Response) {
		res.status(200);
		if (typeof data === 'string') {
			res.setHeader('Content-Length', Buffer.byteLength(data));
			return res.send(data);
		}
		res.setHeader('Content-Length', Buffer.byteLength(JSON.stringify(data)));
		res.json(data);
	}

	private file(data: serveConfig, stat: Stats, res: Response) {
		const mimeType = mime.getType(data.serverPath) ?? 'application/octet-stream';
		res.setHeader('Content-Length', stat.size);
		res.setHeader('Content-Type', mimeType);
		res.writeHead(200);
		createReadStream(data.serverPath).pipe(res);
	}

	private checkSavePage(path: string): save | undefined {
		const currentTime = new Date().getTime();

		for (const x in this.savePage) {
			if (path === this.savePage[x].path) {
				if (this.savePage[x].deadline.getTime() >= currentTime)
					return this.savePage[x];
				else
					this.savePage.splice(Number(x));
				break;
			}
		}
	}

	private timePad(n: number): string {
		if (n < 10)
			return `0${n}`;
		return String(n); 
	}

	private genTime(_stat: Stats): string {
		let ret = '';
		if (_stat.mtime.getUTCDay() > 0)
			ret += `${this.timePad(_stat.mtime.getUTCDay())}-`;
		ret += `${this.month[_stat.mtime.getUTCMonth()]}-${_stat.mtime.getUTCFullYear()} ${this.timePad(_stat.mtime.getUTCHours())}:${this.timePad(_stat.mtime.getUTCMinutes())}`;
		return ret;
	}

	private generateRow(data: statFile): string {
		let ret = `<tr><td><a href="${data.el.dirent[0]}">${data.el.dirent[1]}</a></td>`;
		if (this.options.displayDate)
			ret += `<td>${data.el.time}</td>`;
		if (this.options.displaySize)
			ret += `<td class="date">${data.el.size}</td>`;
		ret += '</tr>';
		return ret;
	}

	private directory(data: serveConfig, res: Response, next: NextFunction) {
		const checkSavePage = this.checkSavePage(data.savePath);
		const elements: statFile[] = [];
		let content = '';
		
		if (this.options.cache !== undefined && checkSavePage)
			return this.send(checkSavePage.data, res);
		readdir(data.serverPath, { encoding: 'utf-8', withFileTypes: true })
			.then(async (dirs) => {
				for (const el of dirs) {
					if ((!el.isDirectory() && !el.isFile())
							|| (!this.options.displayDotfile && el.name.charAt(0) === '.')
							|| (this.options.exclude && this.options.exclude.test(el.name)))
						continue;
					const _stat = await stat(resolve(data.serverPath, el.name));
					elements.push({
						dirent: el,
						el: {
							dirent: [`${data.title}${el.name}`, `${el.name}${(el.isDirectory())
								? '/'
								: ''
							}`],
							time: this.genTime(_stat),
							size: (el.isFile())
								? String(_stat.size)
								: '-'
						}
					});
				}
				if (this.options.json) {
					const ret = elements.map((d) => {
						return {
							isDir: d.dirent.isDirectory(),
							name: d.el.dirent[1],
							path: d.el.dirent[0],
							time: d.el.time,
							size: d.el.size
						};
					});
					if (this.options.cache !== undefined) {
						this.savePage.push({
							json: true,
							data: ret,
							deadline: new Date(new Date().getTime() + this.savePageDeadline),
							path: data.savePath
						});
					}
					return this.send(ret, res);
				}

				if (data.path.length) {
					let url = '';
					const __base = /\/[^/]+\/$/g.exec(data.title);
					if (__base && __base.length)
						url = data.title.replace(__base[0], '');
					else
						url = data.title;
					if (!this.path && data.path.length === 1)
						url = '/';
					content += `<tr><td><a href="${url}">../</a></td></tr>`;
				}

				if (this.options.dirAtTop) {
					for (const dir of elements) {
						if (dir.dirent.isDirectory())
							content += this.generateRow(dir);
					}
					for (const file of elements) {
						if (file.dirent.isFile())
							content += this.generateRow(file);
					}
				} else {
					for (const el of elements)
						content += this.generateRow(el);
				}
				const html = this.htmlPage
					.replaceAll(/{{\s?title\s?}}/g, `Index of ${data.title}`)
					.replaceAll(/{{\s?content\s?}}/g, content);
				if (this.options.cache !== undefined) {
					this.savePage.push({
						json: false,
						data: html,
						deadline: new Date(new Date().getTime() + this.savePageDeadline),
						path: data.savePath
					});
				}
				return this.send(html, res);
			})
			.catch((e) => {
				next(this.error(e));
			});
	}
}

/**
 * `express-autoindex` middleware reproduces a directory listing like Nginx, Apache, etc...
 * 
 * @param {string} root path to the public directory
 * @param {autoIndexOptions | undefined} options middleware options
 */
export default (root: string, options: autoIndexOptions | undefined = undefined): (req: Request, res: Response, next: NextFunction) => void => {
	let instance: autoindex | undefined = undefined;

	return function(req: Request, res: Response, next: NextFunction) {
		if (instance === undefined)
			instance = new autoindex(root, req.baseUrl, options);
		if (instance.options.strict && req.method !== 'GET' && req.method !== 'HEAD') {
			res.status(405);
			res.setHeader('Allow', 'GET, HEAD');
			res.setHeader('Content-Length', '0');
			res.end();
		}
		const newPath = (instance.path)
			? instance.parsePath(`${instance.path}/${req.path}`)
			: instance.parsePath(req.path);
		const splitPath = newPath.split('/').filter((el) => el.length);
		
		if (instance.path && splitPath.length > 0 && splitPath[0] !== instance.path.slice(1))
			return next(instance.error(400));
		instance.serve(splitPath, res, next);
	};
};

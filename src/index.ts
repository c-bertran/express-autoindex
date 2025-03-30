import chardet from 'chardet';
import { accessSync, constants, createReadStream, readFileSync, statSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { STATUS_CODES } from 'http';
import mime from 'mime';
import { platform } from 'os';
import { posix, resolve, win32 } from 'path';
import errorsMap from './errorsMap';

import type { Request, Response, NextFunction } from 'express';
import type { Stats } from 'fs';
import type {
	autoIndexOptions,
	defaultKeyOfJson,
	errorMap,
	save,
	serveConfig,
	statFile,
	dateRegexGroups
} from './interface';

class Autoindex {
	private isProduction: boolean;
	private errorCode: errorMap;
	private htmlPage: string;
	private rowTemplateBase: string;
	private rowTemplateWithDate: string;
	private rowTemplateWithSize: string;
	private rowTemplateWithBoth: string;
	private month: string[];
	private savePage: Map<string, save>;
	private savePageDeadline: number;
	private dateFormat: Map<string, (d: Date | dateRegexGroups) => string>;
	private dateFormatCache: Map<string, string>;
	private dateFormatterIntl: Intl.DateTimeFormat;
	private dateRegexParse: string;
	private dateRegexParseCompiled: RegExp;
	private htmlDateCache: Map<string, string> = new Map();
	private readonly escapeHtmlMap: Record<string, string> = {
		'&': '&#38;', // \x26
		'\n': '&#10;', // \x0A
		'<': '&#60;',
		'>': '&#62;',
		'\'': '&#39;',
		'"': '&#34;'
	};
	
	
	options: autoIndexOptions;
	jsonOption: Record<defaultKeyOfJson, string>;
	path: string | undefined;
	root: string;

	constructor(root: string, path: string, options: autoIndexOptions | undefined) {
		this.isProduction = (process.env.NODE_ENV !== undefined && process.env.NODE_ENV === 'production');
		this.errorCode = errorsMap();
		this.htmlPage = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>{{title}}</title></head><body><h1>{{title}}</h1><hr/><table>{{content}}</table><hr/></body><style type="text/css">html{font-family:Arial,Helvetica,sans-serif}table{font-family:\'Courier New\',Courier,monospace;font-size:12px;font-weight:400;letter-spacing:normal;line-height:normal;font-style:normal}tr td:first-child{min-width:20%}td a{margin-right:1em}td.size{text-align:end}</style></html>';
		this.rowTemplateBase = '<tr><td class="link"><a href="${href}">${name}</a></td></tr>';
		this.rowTemplateWithDate = '<tr><td class="link"><a href="${href}">${name}</a></td><td class="time">${time}</td></tr>';
		this.rowTemplateWithSize = '<tr><td class="link"><a href="${href}">${name}</a></td><td class="size">${size}</td></tr>';
		this.rowTemplateWithBoth = '<tr><td class="link"><a href="${href}">${name}</a></td><td class="time">${time}</td><td class="size">${size}</td></tr>';
		this.month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		this.savePage = new Map();
		this.savePageDeadline = 300000; /// 5 * 60 * 1000 => 5min
		this.dateFormatCache = new Map();
		this.dateFormatterIntl = new Intl.DateTimeFormat('en-US', { 
			calendar: 'iso8601', 
			timeZone: 'UTC', 
			weekday: 'short' 
		});
		this.dateFormat = new Map([
			[
				'%wd',
				(d) => this.dateFormatterIntl.format(d as Date)
			],
			[
				'%d',
				(d) => (d as dateRegexGroups).day
			],
			[
				'%mo',
				(d) => this.month[Number((d as dateRegexGroups).month) - 1]
			],
			[
				'%y',
				(d) => (d as dateRegexGroups).year
			],
			[
				'%h',
				(d) => (d as dateRegexGroups).hours
			],
			[
				'%mi',
				(d) => (d as dateRegexGroups).minutes
			],
			[
				'%s',
				(d) => (d as dateRegexGroups).seconds
			],
			[
				'%ms',
				(d) => (d as dateRegexGroups).milliseconds
			]
		]);

		this.dateRegexParse = '^(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})T(?<hours>\\d{2}):(?<minutes>\\d{2}):(?<seconds>\\d{2})\\.(?<milliseconds>\\d{3})Z$';
		this.dateRegexParseCompiled = new RegExp(this.dateRegexParse, 'gm');

		this.options = {
			alwaysThrowError: options?.alwaysThrowError ?? false,
			cache: options?.cache,
			dateFormat: options?.dateFormat ?? '%d?-%mo-%y %h:%mi',
			dirAtTop: options?.dirAtTop ?? true,
			displayDate: options?.displayDate ?? true,
			displayDotfile: options?.displayDotfile ?? false,
			displaySize: options?.displaySize ?? true,
			exclude: options?.exclude,
			json: options?.json ?? false,
			strict: options?.strict ?? true
		};
		this.jsonOption = options?.customJsonFormat as Record<defaultKeyOfJson, string>;
		this.path = (path.length)
			? path
			: undefined;
		this.root = root;

		if (options?.customTemplate) {
			const genPath = resolve('.', options.customTemplate);
			try {
				this.htmlPage = readFileSync(genPath, { encoding: 'utf-8', flag: 'r' });
			} catch {
				throw new Error(`customTemplate path is incorrect: ${genPath}`);
			}
		}

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

	private formatError(e: NodeJS.ErrnoException, message?: string) {
		let ret = message ?? '';
		if (!this.isProduction) {
			if (message)
				ret += '\n→ ';
			ret += `(${e.message})`;
		}
		return ret;
	}

	private throwError(code: number) {
		if (this.options.alwaysThrowError)
			return true;
		return code >= 500;
	}

	private LRUCache<T>(cache: Map<string, T>, key: string, value: T, maxSize: number): void {
		if (cache.has(key))
			cache.delete(key);
		else if (cache.size >= maxSize) {
			const oldestKey = cache.keys().next().value;
			if (oldestKey)
				cache.delete(oldestKey);
		}
		cache.set(key, value);
	}

	error(e: NodeJS.ErrnoException | number, res: Response) {
		if (typeof e === 'number') {
			if (STATUS_CODES[e])
				res.status(e);
			return (this.throwError(e))
				? new Error(STATUS_CODES[e] ?? `System error code ${e} not recognized`)
				: undefined;
		}
		const error = this.errorCode.get(e.code ?? '__DEFAULT__');
		if (error) {
			res.status(error.httpCode);
			return (this.throwError(error.httpCode))
				? new Error(this.formatError(e, error.message))
				: undefined;
		}
		return new Error(this.formatError(e, `System error code ${e} not recognized`));
	}

	parsePath(path: string): string {
		if (!path.includes('//') && !path.includes('/./') && !path.includes('/../')) {
			if (path.charAt(path.length - 1) === '/' && path.length > 1)
				return path.slice(0, path.length - 1);
			return path;
		}
		path = posix.normalize(path.normalize());
		if (path.charAt(path.length - 1) === '/' && path.length > 1)
			path = path.slice(0, path.length - 1);
		return path;
	}
	
	serve(path: string, res: Response, next: NextFunction) {
		const cleanStr = (s: string) => s.at(0) === '/'
			? s.slice(1)
			: s;
		const cleanPath = (this.path)
			? cleanStr(path).replace(cleanStr(this.path), '')
			: cleanStr(path);
		const cleanPathSplit = cleanPath.split('/').filter((e) => e.length);

		const data: serveConfig = {
			path,
			savePath: cleanPath,
			serverPath: decodeURI(
				platform() === 'win32'
					? win32.normalize(win32.resolve(this.root, ...cleanPathSplit))
					: posix.normalize(posix.resolve(this.root, ...cleanPathSplit))
			),
			title: (cleanStr(cleanPath).length)
				? `/${decodeURI(cleanStr(cleanPath))}/`
				: '/'
		};

		stat(data.serverPath)
			.then((statOfFile) => {
				if (statOfFile.isFile())
					this.file(data, statOfFile, res, next);
				else if (statOfFile.isDirectory())
					this.directory(data, res, next);
				else {
					const err: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, stat '${data.serverPath}'`);
					err.code = 'ENOENT';
					err.syscall = 'stat';
					err.errno = -4058;
					throw err;
				}
			})
			.catch((e) => next(this.error(e, res)));
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

	private dateToHTMLDate(d: Date) {
		const timeKey = d.getTime().toString();
		const cached = this.htmlDateCache.get(timeKey);
		if (cached) return cached;

		this.dateRegexParseCompiled.lastIndex = 0;
		const parseDate = this.dateRegexParseCompiled.exec(d.toISOString());

		let lastModified: string | undefined = undefined;

		if (parseDate && parseDate.groups) {
			const gen = {
				day: this.dateFormatterIntl.format(d),
				dayNumber: (parseDate.groups as unknown as dateRegexGroups).day,
				month: this.month[Number((parseDate.groups as unknown as dateRegexGroups).month) - 1],
				year: (parseDate.groups as unknown as dateRegexGroups).year,
				hours: (parseDate.groups as unknown as dateRegexGroups).hours,
				minutes: (parseDate.groups as unknown as dateRegexGroups).minutes,
				seconds: (parseDate.groups as unknown as dateRegexGroups).seconds
			};
			lastModified = `${gen.day}, ${gen.dayNumber} ${gen.month} ${gen.year} ${gen.hours}:${gen.minutes}:${gen.seconds} GMT`;
		}
		if (lastModified && this.htmlDateCache.size < 500)
			this.htmlDateCache.set(timeKey, lastModified);
		return lastModified;
	}

	private file(data: serveConfig, stat: Stats, res: Response, next: NextFunction) {
		const mimeType = mime.getType(data.serverPath) ?? 'application/octet-stream';
		const lastModified = this.dateToHTMLDate(stat.mtime);

		chardet.detectFile(data.serverPath, { sampleSize: 256 })
			.then((encoding) => {
				res.setHeader('Content-Length', stat.size);
				res.setHeader('Content-Type', `${mimeType}; charset=${encoding ?? 'UTF-8'}`);
				if (lastModified)
					res.setHeader('Last-Modified', lastModified);
				res.writeHead(200);
				createReadStream(data.serverPath)
					.pipe(res);
			})
			.catch((e) => next(this.error(e, res)));
	}

	private checkSavePage(path: string): save | undefined {
		const currentTime = new Date().getTime();
		const cached = this.savePage.get(path);

		if (cached && cached.deadline.getTime() >= currentTime)
			return cached;
		if (cached)
			this.savePage.delete(path);
		return undefined;
	}

	private genTime(_stat: Stats): string {
		const timeKey = _stat.mtime.getTime().toString();
  	const cached = this.dateFormatCache.get(timeKey);
  	if (cached) {
			this.LRUCache(this.dateFormatCache, timeKey, cached, 1000);
			return cached;
		}

		this.dateRegexParseCompiled.lastIndex = 0;
		const parseDate = this.dateRegexParseCompiled.exec(_stat.mtime.toISOString());
		let ret = this.options.dateFormat as string, index = 0;

		if (parseDate && parseDate.groups) {
			for (const format of this.dateFormat) {
				while ((index = ret.indexOf(format[0])) > -1) {
					const funcRet = format[1](parseDate.groups as unknown as dateRegexGroups);
					const i = index + format[0].length;
	
					if (!funcRet || funcRet.length <= 0) {
						if (ret.charAt(i) === '?')
							ret = ret.slice(0, i) + ret.slice(i + 2);
						ret = ret.replace(format[0], '');
					} else {
						if (ret.charAt(i) === '?')
							ret = ret.slice(0, i) + ret.slice(i + 1);
						ret = ret.replace(format[0], funcRet);
					}
				}
			}
		}

		this.LRUCache(this.dateFormatCache, timeKey, ret, 1000);
		return ret;
	}

	private escapeHtml(str: string): string {
		// eslint-disable-next-line no-control-regex
		return str.replace(/[\x26\x0A<>'"]/g, char => this.escapeHtmlMap[char] || `&#${char.charCodeAt(0)};`);
	}

	private generateRow(data: statFile): string {
		const href = data.el.dirent[0];
		const name = data.el.dirent[1];

		if (this.options.displayDate && this.options.displaySize) {
			return this.rowTemplateWithBoth
				.replace('${href}', href)
				.replace('${name}', name)
				.replace('${time}', this.escapeHtml(data.el.time))
				.replace('${size}', data.el.size);
		}
		if (this.options.displayDate) {
			return this.rowTemplateWithDate
				.replace('${href}', href)
				.replace('${name}', name)
				.replace('${time}', this.escapeHtml(data.el.time));
		}
		if (this.options.displaySize) {
			return this.rowTemplateWithSize
				.replace('${href}', href)
				.replace('${name}', name)
				.replace('${size}', data.el.size);
		}
		return this.rowTemplateBase
			.replace('${href}', href)
			.replace('${name}', name);
	}

	private generateJson(element: statFile): Record<string, boolean | string | number> {
		const isDir = element.dirent.isDirectory();

		if (!this.jsonOption) {
			return {
				isDir,
				name: element.el.dirent[1],
				path: element.el.dirent[0],
				time: element.el.time,
				size: Number(element.el.size)
			};
		}

		const ret: Record<defaultKeyOfJson | string, boolean | string | number> = {};
		const jsonOpt = this.jsonOption;
		if ('isDir' in jsonOpt) ret[jsonOpt.isDir] = isDir;
		if ('name' in jsonOpt) ret[jsonOpt.name] = element.el.dirent[1];
		if ('path' in jsonOpt) ret[jsonOpt.path] = element.el.dirent[0];
		if ('time' in jsonOpt) ret[jsonOpt.time] = element.el.time;
		if ('size' in jsonOpt) ret[jsonOpt.size] = Number(element.el.size);

		return ret;
	}

	private directory(data: serveConfig, res: Response, next: NextFunction) {
		const checkSavePage = this.checkSavePage(data.savePath);
		const elements: statFile[] = [];
		const genFiles: string[] = [], genDirs: string[] = [], htmlContent: string[] = [];
		let dataReturn: string | Record<string, any>;
		
		if (this.options.cache !== undefined && checkSavePage)
			return this.send(checkSavePage.data, res);
		readdir(data.serverPath, { encoding: 'utf-8', withFileTypes: true })
			.then(async (dirs) => {
				const filteredDirs = dirs.filter(el => 
					(el.isDirectory() || el.isFile()) && 
					(this.options.displayDotfile || el.name.charAt(0) !== '.') &&
					(!this.options.exclude || !this.options.exclude.test(el.name))
				);
				const results = await Promise.all(
					filteredDirs.map(async el => {
						const _stat = await stat(resolve(data.serverPath, el.name));
						return { dirent: el, stat: _stat };
					})
				);

				for (const { dirent: el, stat: _stat } of results) {
					elements.push({
						dirent: el,
						el: {
							dirent: [
								`${(this.path)
									? this.parsePath(`${this.path}${data.title}${el.name}`)
									: this.parsePath(this.path as string)
								}`,
								`${el.name}${(el.isDirectory())
									? '/'
									: ''
								}`
							],
							time: this.genTime(_stat),
							size: (el.isFile())
								? String(_stat.size)
								: '-'
						}
					});
				}
				if (this.options.json)
					dataReturn = elements.map((e) => this.generateJson(e));
				else {
					if (data.title.localeCompare('/') !== 0)
						htmlContent.push(`<tr><td><a href="${data.path.replace(/[^/]+$/, '')}">../</a></td></tr>`);
					for (const el of elements) {
						if (this.options.dirAtTop) {
							if (el.dirent.isDirectory())
								genDirs.push(this.generateRow(el));
							else if (el.dirent.isFile())
								genFiles.push(this.generateRow(el));
						} else
							htmlContent.push(this.generateRow(el));
					}
					if (this.options.dirAtTop) {
						for (const dir of genDirs)
							htmlContent.push(dir);
						for (const file of genFiles)
							htmlContent.push(file);
					}
					dataReturn = this.htmlPage
						.replaceAll(/{{\s?title\s?}}/g, `Index of ${data.title}`)
						.replaceAll(/{{\s?content\s?}}/g, htmlContent.join(''));
				}

				if (this.options.cache !== undefined) {
					this.savePage.set(data.savePath, {
						json: this.options.json ?? false,
						data: dataReturn,
						deadline: new Date(new Date().getTime() + this.savePageDeadline),
						path: data.savePath
					});
				}

				return this.send(dataReturn, res);
			})
			.catch((e) => next(this.error(e, res)));
	}
}

/**
 * `express-autoindex` middleware reproduces a directory listing like Nginx, Apache, etc...
 * 
 * @param {string} root path to the public directory
 * @param {autoIndexOptions | undefined} options middleware options
 */
export default (root: string, options: autoIndexOptions | undefined = undefined): (
	(req: Request, res: Response, next: NextFunction) => void
) => {
	const instance = new Autoindex(root, '', options);

	return (req: Request, res: Response, next: NextFunction) => {
		if (req.baseUrl && (!instance.path || instance.path !== req.baseUrl))
			instance.path = req.baseUrl;
		if (instance.options.strict && req.method !== 'GET' && req.method !== 'HEAD') {
			res.status(405);
			res.setHeader('Allow', 'GET, HEAD');
			res.setHeader('Content-Length', '0');
			res.end();
			return;
		}
		const newPath = (instance.path)
			? instance.parsePath(`${instance.path}/${req.path}`)
			: instance.parsePath(req.path);
		if (instance.path && !newPath.length)
			next(instance.error(400, res));
		else
			instance.serve(newPath, res, next);
	};
};

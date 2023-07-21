import type { Dirent } from 'fs';

export type errorMap = Map<string, { message: string, httpCode: number }>;

export interface autoIndexOptions {
	/**
	 * Caches for a defined time the generated pages. Very useful to save server resources
	 * 
	 * Pass `false` to disable the cache, or the number of milliseconds representing the cache expiration time
	 * 
	 * Default to `300000` => 5 mins
	 */
	cache?: number | false;
	
	/**
	 * Display directories before files
	 *
	 * Default to `false`
	 */
	dirAtTop?: boolean;

	/**
	 * Display the last modification date of the file or directory if available
	 * 
	 * Default to `true`
	 */
	displayDate?: boolean;

	/**
	 * Display dotfiles (.env, .yarnrc, ...)
	 *
	 * Default to `false`
	 */
	displayDotfile?: boolean;

	/**
	 * Display size of the file or directory if available
	 * 
	 * Default to `true`
	 */
	displaySize?: boolean;

	/**
	 * Regular expression for files/dirs exclude, for example `/my-file.json|\*.cpp/`
	 */
	exclude?: RegExp;

	/**
	 * Send data in json format instead of an html page. Might be useful if you want to use the data for another application
	 * 
	 * Default to `false`
	 */
	json?: boolean;

	/**
	 * Allow only `HEAD` and `GET` HTTP methods
	 * 
	 * Default to `true`
	 */
	strict?: boolean;
}

export interface statFile {
	dirent: Dirent;
	el: {
		dirent: string[];
		size: string;
		time: string;
	}
}

export interface serveConfig {
	path: string[];
	savePath: string;
	serverPath: string;
	title: string;
}

export interface save {
	json: boolean;
	data: string | Record<string, any>;
	deadline: Date;
	path: string;
}
import type { Dirent } from 'fs';

export interface autoIndexOptions {
	/**
	 * Cache data based of time, default to 5 minutes
	 * 
	 * Pass false to disable the option
	 * 
	 * Accept number of milliseconds
	 * 
	 * 
	 * Default to `300000` => 5 mins
	 */
	cache?: number | false;
	
	/**
	 * Display directory at top
	 *
	 * Default to `false`
	 */
	dirAtTop?: boolean;

	/**
	 * Display date
	 * 
	 * Default to `true`
	 */
	displayDate?: boolean;

	/**
	 * Display dotfiles
	 * * 
	 * Default to `false`
	 */
	displayDotfile?: boolean;

	/**
	 * Display size
	 * 
	 * Default to `true`
	 */
	displaySize?: boolean;

	/**
	 * Regular expression for files/dirs exclude
	 * 
	 * Default to `undefined`
	 */
	exclude?: RegExp | undefined;

	/**
	 * Display json output instead of html
	 * 
	 * Default to `false`
	 */
	json?: boolean;

	/**
	 * Flag for allow `HEAD` and `GET` HTTP methods only
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
# express-autoindex

`express-autoindex` produce a directory listing like Nginx, Apache, etc...

It takes into consideration most of the mime-types correctly, and page generation is fully customizable.

The objectives are:
* Make a `HTML` page or `JSON` data easily usable, on the great majority of browsers
* Correctly take into consideration the majority of `MIME types`, and the generation of the most customizable pages possible
* Native support for `Typescript`, `EcmaScript` and `CommonJS`
* The least amount of dependency possible (currently only `one`)
* The `lightest` possible

<p align="center">
	<img width="500" alt="Exemple image" src="./src/img.png"/>
</p>

## Install

```sh
# npm
npm install express-autoindex

# yarn
yarn add express-autoindex
```

## API

```ts
import autoindex from 'express-autoindex';

// Root of server, ./public dir
app.use(autoindex('public'))

// Specific path `/files`, ./public dir
app.use('/files', autoindex('public'));

// Set options
app.use('/files', autoindex('public', { dirAtTop: false, displaySize: false }));
```

### autoindex(path, options)

Returns middlware that serves an index of the directory in the given `path`.

The `path` is based of the `req.url` value, so a `req.url` of `'/some/dir`
with a `path` of `'public'` will look at `'public/some/dir'`

### Options

`express-autoindex` accepts options:

* #### cache
  type: `number | false`

  Caches for a defined time the generated pages. Very useful to save server resources.
  Pass `false` to disable the cache, or the number of milliseconds representing the cache expiration time

  **Default** to `300000` = 5 mins

* #### dirAtTop
  type: `boolean`

  Display directories before files

  **Default** to `true`

* #### displayDate
  type: `boolean`

  Display the last modification date of the file or directory if available

  **Default** to `true`

* #### displayDotfile
  type: `boolean`

  Display dotfiles (.env, .yarnrc, ...)

  **Default** to `false`

* #### displaySize
  type: `boolean`

  Display size of the file or directory if available

  **Default** to `true`

* #### exclude
  type: `RegExp`

  Regular expression for files/dirs exclude, for example `/my-file.json|\*.cpp/`

* #### json
  type: `boolean`

  Send data in json format instead of an html page. Might be useful if you want to use the data for another application

  **Default** to `false`

* #### strict
  type: `boolean`

  Allow only `HEAD` and `GET` HTTP methods
	
  **Default** to `true`

## Error handling

`express-autoindex` will do its best to handle Node.js errors correctly by converting them into a valid HTTP error. The default error type is **500**.

In no case `express-autoindex` handles custom error pages. The only thing done is to modify the statusCode of the `res` object and generate an error if necessary.

### NodeJS error code list

Below is a list of currently supported errors.

This is how to read the list: *The Node error code* → (**the related HTTP code**) "The error message"

- *EBADF* → (**500**) fd is not a valid open file descriptor
- *EFAULT* → (**500**) Bad address
- *EINVAL* → (**500**) Invalid flag specified in flag
- *ELOOP* → (**500**) Too many symbolic links encountered while traversing the path
- *ENOMEM* → (**500**) Out of memory
- *EOVERFLOW* → (**500**)	pathname or fd refers to a file whose size, inode number,
	</br>
	or number of blocks cannot be represented in, respectively, the types off_t, ino_t, or blkcnt_t.
	</br>
	This error can occur when, for example, an application compiled on a 32-bit platform
	</br>
	without -D_FILE_OFFSET_BITS=64 calls stat() on a file whose size exceeds (1<<31)-1 bytes
- *EACCES* → (**500**) Permission denied
- *EADDRINUSE* → (**500**) Address already in use
- *ECONNREFUSED* → (**500**) Connection refused
- *ECONNRESET* → (**500**) Connection reset by peer
- *EEXIST* → (**500**) File exists
- *EISDIR* → (**500**) Is a directory
- *EMFILE* → (**500**) Too many open files in system
- *ENAMETOOLONG* → (**414**) URI Too Long
- *ENOENT* → (**404**) No such file or directory
- *ENOTDIR* → (**404**) Not a directory
- *ENOTEMPTY* → (**500**) Directory not empty
- *ENOTFOUND* → (**500**) DNS lookup failed
- *EPERM* → (**403**) Operation not permitted
- *EPIPE* → (**500**) Broken pipe
- *ETIMEDOUT* → (**408**) Request Timeout

### Example code

To handle these errors, all you need to do after calling this middleware is to use a code of this type:

```ts
[...]
app.use('/public', autoindex('/files'));
app.use((err, _req, res, next) => {
	log.error(err);
	if (res.statusCode === 404) {
		const ret = { error: 'A 404 error', code: res.statusCode };
		res.setHeader('Content-Length', Buffer.byteLength(JSON.stringify(ret)));
		res.json(ret);
	}
	next();
});
[...]
```

## Minimalist example

```ts
import express from 'express';
import autoindex from 'express-autoindex';
import type { Application, NextFunction, Request, Response } from 'express';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', autoindex('public', { cache: 900000 /* 15 min */ }));
app.listen(PORT, (): void => {
	console.log(`server is running at ${PORT}`);
});
```

## Production mode

When the variable `process.env.NODE_ENV` is set to **production**, error messages are much less detailed for security reasons.

## To do list

1. Customization of the html page appearance
2. Customization of json data
3. Formatting of file modification dates
4. Open the middleware for use outside express.js

## License

[MIT](LICENSE)

## Dependencie

[mime](https://www.npmjs.com/package/mime)

# express-autoindex

`express-autoindex` produce a directory listing like Nginx, Apache, etc...

It takes into consideration most of the mime-types correctly, and page generation is fully customizable.

The objectives are:
* Make a `HTML` page or `JSON` data easily usable, on the great majority of browsers
* Correctly take into consideration the majority of `MIME types`, and the generation of the most customizable pages possible
* Native support for `Typescript`, `EcmaScript` and `CommonJS`
* The least amount of dependency possible (currently only `one`)
* The lightest possible (`10 Ko`)

## Install

```sh
# npm
npm install express-autoindex

# yarn
yarn add express-autoindex
```

## API

```js
import autoindex from 'express-autoindex';

// Root of server, ./public dir
app.use(autoindex('public'))

// Specific path `/files`, ./public dir
app.use('/files', autoindex('public'));
```

### autoindex(path, options)

Returns middlware that serves an index of the directory in the given `path`.

The `path` is based off the `req.url` value, so a `req.url` of `'/some/dir`
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
  **Default** to `false`

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

* #### json
  type: `boolean`

  Allow only `HEAD` and `GET` HTTP methods
  **Default** to `true`

## Minimalist example

```ts
import express from 'express';
import autoindex from 'express-autoindex';
import type { Application, NextFunction, Request, Response } from 'express';

const app: Application = express();
const PORT = 3000 || process.env.PORT;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', autoindex('public', { cache: 900000 /* 15 min */ }));
app.listen(PORT, (): void => {
	console.log(`server is running at ${PORT}`);
});
```

## To do list

1. Customization of the html page appearance
2. Customization of json data
3. Formatting of file modification dates
4. Open the middleware for use outside express.js

## License

[GPL-3.0](LICENSE)

## Dependencie

[mime](https://www.npmjs.com/package/mime)

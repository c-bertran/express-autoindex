import { STATUS_CODES } from 'http';
import type { errorMap } from './interface';

type tempError = Map<string, { message: string, httpCode?: number }>;

export default (): errorMap => {
	const statErrors: tempError = new Map([
		['EBADF', { message: 'fd is not a valid open file descriptor' }],
		['EFAULT', { message: 'Bad address' }],
		['EINVAL', { message: 'Invalid flag specified in flag' }],
		['ELOOP', { message: 'Too many symbolic links encountered while traversing the path' }],
		['ENOMEM', { message: 'Out of memory' }],
		['EOVERFLOW', { message: 'pathname or fd refers to a file whose size, inode number, or number of blocks cannot be represented in, respectively, the types off_t, ino_t, or blkcnt_t.\nThis error can occur when, for example, an application compiled on a 32-bit platform without -D_FILE_OFFSET_BITS=64 calls stat() on a file whose size exceeds (1<<31)-1 bytes.'}],
	]);
	const generalError: tempError = new Map([
		['EACCES', { message: 'Permission denied' }],
		['EADDRINUSE', { message: 'Address already in use' }],
		['ECONNREFUSED', { message: 'Connection refused' }],
		['ECONNRESET', { message: 'Connection reset by peer' }],
		['EEXIST', { message: 'File exists' }],
		['EISDIR', { message: 'Is a directory' }],
		['EMFILE', { message: 'Too many open files in system' }],
		['ENAMETOOLONG', { message: STATUS_CODES[414] as string, httpCode: 414 }],
		['ENOENT', { message: 'No such file or directory', httpCode: 404 }],
		['ENOTDIR', { message: 'Not a directory', httpCode: 404 }],
		['ENOTEMPTY', { message: 'Directory not empty' }],
		['ENOTFOUND', { message: 'DNS lookup failed' }],
		['EPERM', { message: 'Operation not permitted', httpCode: 403 }],
		['EPIPE', { message: 'Broken pipe' }],
		['ETIMEDOUT', { message: STATUS_CODES[408] as string, httpCode: 408 }]
	]);

	const ret: tempError = new Map([ ...statErrors, ...generalError ]);
	ret.forEach((e, key) => {
		if (!e.httpCode)
			ret.set(key, { message: e.message, httpCode: 500 });
	});

	return ret as errorMap;
};

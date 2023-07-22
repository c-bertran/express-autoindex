import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

export default {
	external: [
		'chardet',
		'http',
		'fs',
		'fs/promises',
		'path',
		'mime'
	],
	input: 'src/index.ts',
	output: [
		{
			entryFileNames: '[name].[format].js',
			format: 'es',
			dir: 'dist'
		},
		{
			entryFileNames: '[name].[format].js',
			format: 'cjs',
			dir: 'dist'
		}
	],
	plugins: [
		typescript(),
		terser()
	]
};

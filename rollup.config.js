import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const banner = '/**\n* @license\n* express-autoindex\n* Copyright (c) 2023-present, c-bertran (Clément Bertrand) (https://github.com/c-bertran)\n*\n* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN\n* THE SOFTWARE.\n*/';

export default {
	external: [
		'chardet',
		'fs',
		'fs/promises',
		'http',
		'mime',
		'os',
		'path'
	],
	input: 'src/index.ts',
	output: [
		{
			banner,
			chunkFileNames: '[name]_[hash].[format].js',
			entryFileNames: '[name].[format].js',
			format: 'es',
			dir: 'dist'
		},
		{
			banner,
			chunkFileNames: '[name]_[hash].[format].js',
			entryFileNames: '[name].[format].js',
			format: 'cjs',
			dir: 'dist'
		}
	],
	watch: {
		clearScreen: false,
	},
	plugins: [
		typescript(),
		terser()
	]
};

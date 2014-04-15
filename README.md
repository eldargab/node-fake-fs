# fake-fs

Fake node.js file system for testing. Supports `stat`, `exists`, `readdir`,
`readFile`, `writeFile`, `mkdir`, `rmdir`, `unlink`, `rename` and their sync counterparts.

## Usage

``` javascript
var Fs = require('fake-fs')
var fs = new Fs
```

Define a dir

``` javascript
fs.dir('a/b/c')
fs.existsSync('a/b/c').should.be.true
fs.existsSync('a').should.be.true // note that it works like mkdir -p
fs.existsSync('.').should.be.true // in fact you defined an item at absolute path
fs.existsSync(process.cwd()).should.be.true
```

Dir with some meta

``` javascript
fs.dir('bin', {
  mtime: 100, // by default it will be set to (new Date)
  atime: 300,
  ctime: 50
})
fs.statSync('bin').should.have.property('mtime').equal(100)
```

Define an empty file

``` javascript
fs.file('foo/bar.txt')
fs.readFileSync('foo/bar.txt', 'utf8').should.equal('')
fs.statSync('foo').isDirectory().should.be.true // foo automatically created
```

Define a file with content

``` javascript
fs.file('hello.txt', 'Hello world') // utf8 assumed
fs.file('base64.txt', 'TWFu', 'base64')
fs.file('bin', new Buffer([10, 20]))
```

Define a file with arbitrary attributes

``` javascript
fs.file('file', {
  content: 'asdf',
  mtime: new Date,
  hello: 'hello'
})

fs.readFileSync('file', 'utf8').should.equal('asdf')
fs.statSync('file').should.have.property('hello').equal('hello')
```

Sometimes you may want to define several items at one location. The `.at(path)`
returns a proxy which prefixes everything you defined with `path`.

``` javascript
fs.at('public/assets')
  .file('style.css')
  .file('icons.png')
fs.existsSync('public/assets/icons.png').should.be.true
```

It also has convenience methods for patching-unpatching of global `fs` object.

``` javascript
fs.patch()
fs.dir('foo')
require('fs').existsSync('foo').should.be.true
fs.unpatch()
require('fs').existsSync('foo').should.be.false
```

## Notes

Methods of newly created `fs` object are not binded to that instance.
That means

```javascript
var fs = new Fs
var exists = fs.existsSync
exists('/foo/bar')
```

doesn't work. You can use `.bind()` if that's a problem.

```javascript
var fs = new Fs().bind()
var exists = fs.existsSync
exists('/foo/bar') // now everything is ok
```

## Supported features

```
.stat()
  ✓ Should return stats
  ✓ Should throw ENOENT on non-existent path
  ✓ Should support absolute paths
.readdir()
  ✓ Should list a dir contents
  ✓ Should throw ENOENT on non-existent path
  ✓ Should throw ENOTDIR on non-dir
.exists()
  ✓ Should return true on existent path
  ✓ Should return false for non-existent path
  ✓ Should return true for root path
.mkdir()
  ✓ Should create dir
  ✓ Should ignore mode
  ✓ Should throw EEXIST on existing item
  ✓ Should throw ENOENT on non-existent parent
  ✓ Should throw ENOTDIR on non-dir parent
  ✓ Should update parent times
.rmdir()
  ✓ Should remove an existing direcory
  ✓ Should throw ENOTEMPTY for non empty dirs
  ✓ Should throw an ENOTDIR error on file
  ✓ Should update dir times on directory removal
.unlink()
  ✓ Should remove an existing file
  ✓ Should throw an EISDIR error on directory
  ✓ Should update dir times on file removal
.rename()
  ✓ Should rename an existing file
  ✓ Should rename (move) an existing file
  ✓ Should rename an existing directory
  ✓ Should rename (move) an existing directory
  ✓ Should throw EPERM when new path points to an existing directory
  ✓ Should not throw EPERM when new path points to existing file
  ✓ Should throw ENOENT when new (directory) path points to a non-existent parent
  ✓ Should throw ENOTDIR when new path points to a parent that is not a directory
  ✓ Should update dir times on rename (move)
.readFile()
  ✓ Should read file contents
  ✓ Should decode file contents
  ✓ Should throw ENOENT on non-existent file
  ✓ Should throw EISDIR on directory
.writeFile()
  ✓ Should write file
  ✓ Should respect encoding
  ✓ Should allow to write buffers
  ✓ Should throw ENOTDIR when parent is not a dir
  ✓ Should throw ENOENT whent parent dir does not exist
  ✓ Should update dir times on file creation
  ✓ Should not update dir times on file update
```

## Installation

Via npm

```
npm install fake-fs
```

To run tests use `npm test` command.

```
npm install
npm test
```

## License

(The MIT License)

Copyright (c) 2012 Eldar Gabdullin <eldargab@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

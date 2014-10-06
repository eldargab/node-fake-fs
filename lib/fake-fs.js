var PATH = require('path')
var normalize = PATH.normalize
var join = PATH.join
var dirname = PATH.dirname
var basename = PATH.basename

function resolve(p) {
  return PATH.resolve(p).replace(/\\/g, '/') // Windows support
}

function FsError(code) {
  var err = new Error(code)
  err.code = code
  return err
}

function toBuffer(data, encoding) {
  data = data || new Buffer(0)
  return Buffer.isBuffer(data)
    ? data
    : new Buffer(data, encoding || 'utf8')
}

function initTimes(o) {
  var now = new Date
  o.mtime = now
  o.ctime = now
  o.atime = now
}

function updateTimes(stat) {
  var now = new Date
  stat.mtime = now
  stat.ctime = now
}

function Dir(stats) {
  initTimes(this)
  mix(this, stats)
  this.children = {}
}

Dir.prototype.isDirectory = function() {
  return true
}

Dir.prototype.isFile = function() {
  return false
}

Dir.prototype.toString = function() {
  return 'directory'
}

function File(stats) {
  initTimes(this)
  mix(this, stats)
}

File.prototype.isDirectory = function() {
  return false
}

File.prototype.isFile = function() {
  return true
}

File.prototype.toString = function() {
  return 'file'
}

module.exports = Fs

function Fs (paths) {
  if (!(this instanceof Fs)) {
    return new Fs(paths)
  }
  this.root = new Dir
}

Fs.prototype.dir = function(path, opts) {
  return this._add(path, new Dir(opts))
}

Fs.prototype.file = function(path, content, encoding) {
  var stat = typeof content == 'object' && !Buffer.isBuffer(content) && content
  if (stat) {
    content = stat.content
    encoding = stat.encoding
  }
  var file = new File(stat || {})
  file.content = toBuffer(content, encoding)
  return this._add(path, file)
}

Fs.prototype._add = function(path, item) {
  var segs = path == '/'
    ? []
    : resolve(path).split('/').slice(1)

  var dir = this.root
  for (var i = 0; i < segs.length - 1; i++) {
    dir = dir.children[segs[i]] || (dir.children[segs[i]] = new Dir)
    if (!dir.isDirectory()) {
      throw new Error('There is already ' + dir + ' defined at ' + segs.slice(i).join('/'))
    }
  }
  dir.children[segs[i]] = item
  return this
}

Fs.prototype._itemAt = function(path) {
  var segs = path == '/'
    ? []
    : resolve(path).split('/').slice(1)

  var item = this.root
  for (var i = 0; i < segs.length; i++) {
    item = item.children && item.children[segs[i]]
    if (!item) return
  }
  return item
}

Fs.prototype._get = function(path) {
  var item = this._itemAt(path)
  if (!item) throw FsError('ENOENT')
  return item
}

Fs.prototype._rem = function(path) {
  var parent = this._get(dirname(path))
  if (!parent.isDirectory()) throw FsError('ENOTDIR')
  var itemName = basename(path)
  delete parent.children[itemName]
}

Fs.prototype.statSync = function(path) {
  return this._get(path)
}

Fs.prototype.existsSync = function(path) {
  return !!this._itemAt(path)
}

Fs.prototype.readdirSync = function(dir) {
  var item = this._get(dir)
  if (!item.isDirectory()) throw FsError('ENOTDIR')
  return Object.keys(item.children)
}

Fs.prototype.readFileSync = function(filename, options) {
  var encoding = options && ((typeof options === 'string') ? options : options.encoding)
  var item = this._get(filename)
  if (item.isDirectory()) throw FsError('EISDIR')
  var buf = item.content
  return encoding ? buf.toString(encoding) : buf
}

Fs.prototype.writeFileSync = function(filename, data, options) {
  var encoding = options && ((typeof options === 'string') ? options : options.encoding)
  var parent = this._get(dirname(filename))
  if (!parent.isDirectory()) throw FsError('ENOTDIR')
  if (!this.existsSync(filename)) {
    updateTimes(parent)
  }
  this.file(filename, data, encoding)
}

Fs.prototype.appendFileSync = function(filename, data, options) {
  var encoding = options && ((typeof options === 'string') ? options : options.encoding)
  var item = this._itemAt(filename)
  if (item) {
    if (item.isDirectory()) throw FsError('EISDIR')
    item.content = Buffer.concat([item.content, toBuffer(data, encoding)])
    updateTimes(item)
  } else {
    this.writeFileSync(filename, data, encoding)
  }
}

Fs.prototype.mkdirSync = function(dir, mode) {
  if (this.existsSync(dir)) throw FsError('EEXIST')
  var parent = this._get(dirname(dir))
  if (!parent.isDirectory()) throw FsError('ENOTDIR')
  updateTimes(parent)
  this.dir(dir)
}

Fs.prototype.rmdirSync = function(path) {
  if (!this.existsSync(path)) throw FsError('ENOENT')

  var item = this._get(path)
  if (!item.isDirectory()) throw FsError('ENOTDIR')

  var hasChildren = item.children && Object.keys(item.children).length
  if (hasChildren) throw FsError('ENOTEMPTY')

  var parent = this._get(dirname(path))
  updateTimes(parent)
  this._rem(path)
}

Fs.prototype.unlinkSync = function(path) {
  if (!this.existsSync(path)) throw FsError('ENOENT')

  var item = this._get(path)
  if (item.isDirectory()) throw FsError('EISDIR')

  var parent = this._get(dirname(path))
  updateTimes(parent)
  this._rem(path)
}

Fs.prototype.renameSync = function(oldPath, newPath) {
  if (!this.existsSync(oldPath)) throw FsError('ENOENT')

  if (this.existsSync(newPath) && this.statSync(newPath).isDirectory())
   throw FsError('EPERM')

  var newParent = this._get(dirname(newPath))
  if (!newParent.isDirectory()) throw FsError('ENOTDIR')

  var fileOrDir = this._get(oldPath)

  var oldParent = this._get(dirname(oldPath))
  updateTimes(oldParent)
  this._rem(oldPath)

  updateTimes(newParent)
  this._add(newPath, fileOrDir)
}

;['readdir', 'stat', 'rmdir', 'unlink'].forEach(function(meth) {
  var sync = meth + 'Sync'
  Fs.prototype[meth] = function(p, cb) {
    var res, err
    try {
      res = this[sync].call(this, p)
    } catch(e) {
      err = e
    }
    cb && cb(err, res)
  }
})

Fs.prototype.readFile = function(filename, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = undefined
  }
  var res, err
  try {
    res = this.readFileSync(filename, options)
  } catch(e) {
    err = e
  }
  cb && cb(err, res)
}

Fs.prototype.writeFile = function(filename, data, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = null
  }
  var err
  try {
    this.writeFileSync(filename, data, options)
  } catch(e) {
    err = e
  }
  cb && cb(err)
}

Fs.prototype.appendFile = function(filename, data, opts, cb) {
  if (typeof opts == 'function') {
    cb = opts
    opts = null
  }
  var err
  try {
    this.appendFileSync(filename, data, opts)
  } catch(e) {
    err = e
  }
  cb && cb(err)
}

Fs.prototype.exists = function(path, cb) {
  cb && cb(this.existsSync(path))
}

Fs.prototype.mkdir = function(dir, mode, cb) {
  if (typeof mode == 'function') {
    cb = mode
  }
  var res, err
  try {
    res = this.mkdirSync(dir)
  } catch (e) {
    err = e
  }
  cb && cb(err, res)
}

Fs.prototype.rename = function(oldPath, newPath, cb) {
  var res, err
  try {
    res = this.renameSync(oldPath, newPath)
  } catch (e) {
    err = e
  }
  cb && cb(err, res)
}

Fs.prototype.bind = function() {
  for(var key in this) {
    if (typeof this[key] == 'function')
      this[key] = this[key].bind(this)
  }
  return this
}

Fs.prototype.patch = function() {
  this._orig = {}
  var fs = require('fs')
  methods.forEach(function(meth) {
    this._orig[meth] = fs[meth]
    fs[meth] = this[meth].bind(this)
  }, this)
}

Fs.prototype.unpatch = function() {
  var fs = require('fs')
  for (var key in this._orig) {
    fs[key] = this._orig[key]
  }
}

var methods = [
  'exists',
  'stat',
  'readdir',
  'mkdir',
  'readFile',
  'writeFile',
  'appendFile',
  'rmdir',
  'unlink',
  'rename'
].reduce(function(res, meth) {
  res.push(meth)
  res.push(meth + 'Sync')
  return res
}, [])

Fs.prototype.at = function(path) {
  return new Proxy(this, path)
}

function Proxy(fs, path) {
  this.fs = fs
  this.path = path
}

Proxy.prototype.dir = function(p) {
  p = join(this.path, p)
  this.fs.dir.apply(this.fs, arguments)
  return this
}

Proxy.prototype.file = function(p) {
  p = join(this.path, p)
  this.fs.file.apply(this.fs, arguments)
  return this
}

Proxy.prototype.at = function(p) {
  p = join(this.path, p)
  return this.fs.at.apply(this.fs, arguments)
}

function mix(t, src) {
  for(var key in src) {
    t[key] = src[key]
  }
  return t
}
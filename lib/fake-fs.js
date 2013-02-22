var stat = require('./stat')
var PATH = require('path')
var normalize = PATH.normalize
var join = PATH.join
var dirname = PATH.dirname
var basename = PATH.basename

function resolve (p) {
    return PATH.resolve(p).replace(/\\/g, '/') // Windows support
}

function FsError (code) {
    var err = new Error(code)
    err.code = code
    return err
}


module.exports = Fs

function Fs (paths) {
    this.root = new stat.Dir
}

Fs.prototype.dir = function (path, opts) {
    return this._add(path, new stat.Dir(opts))
}

Fs.prototype.file = function (path, content, encoding) {
    return this._add(path, new stat.File(content, encoding))
}

Fs.prototype._add = function (path, item) {
    var segs = path == '/'
        ? []
        : resolve(path).split('/').slice(1)

    var dir = this.root
    for (var i = 0; i < segs.length - 1; i++) {
        dir = dir.childs[segs[i]] || (dir.childs[segs[i]] = new stat.Dir)
        if (!dir.isDirectory()) {
            throw new Error('There is already ' + dir + ' defined at ' + segs.slice(i).join('/'))
        }
    }
    dir.childs[segs[i]] = item
    return this
}

Fs.prototype._itemAt = function (path) {
    var segs = path == '/'
        ? []
        : resolve(path).split('/').slice(1)

    var item = this.root
    for (var i = 0; i < segs.length; i++) {
        item = item.childs && item.childs[segs[i]]
        if (!item) return
    }
    return item
}

Fs.prototype._get = function (path) {
    var item = this._itemAt(path)
    if (!item) throw FsError('ENOENT')
    return item
}

Fs.prototype._rem = function (path) {
    var parent = this._get(dirname(path))
    if (!parent.isDirectory()) throw FsError('ENOTDIR')

    var itemName = basename(path)
    delete parent.childs[itemName]
}


Fs.prototype.statSync = function (path) {
    return this._get(path)
}

Fs.prototype.existsSync = function (path) {
    return !!this._itemAt(path)
}

Fs.prototype.readdirSync = function (dir) {
    var item = this._get(dir)
    if (!item.isDirectory()) throw FsError('ENOTDIR')
    return Object.keys(item.childs)
}

Fs.prototype.readFileSync = function (filename, encoding) {
    var item = this._get(filename)
    if (item.isDirectory()) throw FsError('EISDIR')
    return item.read(encoding)
}

Fs.prototype.writeFileSync = function (filename, data, encoding) {
    var parent = this._get(dirname(filename))
    if (!parent.isDirectory()) throw FsError('ENOTDIR')
    if (!this.existsSync(filename)) {
        updateTimes(parent)
    }
    this.file(filename, data, encoding)
}

Fs.prototype.mkdirSync = function (dir, mode) {
    if (this.existsSync(dir)) throw FsError('EEXIST')
    var parent = this._get(dirname(dir))
    if (!parent.isDirectory()) throw FsError('ENOTDIR')
    updateTimes(parent)
    this.dir(dir)
}

Fs.prototype.rmdirSync = function (path) {
    if (!this.existsSync(path)) throw FsError('ENOENT')

    var item = this._get(path)
    if (!item.isDirectory()) throw FsError('ENOTDIR')

    var hasChildren = item.childs && Object.keys(item.childs).length
    if (hasChildren) throw FsError('ENOTEMPTY')

    var parent = this._get(dirname(path))
    updateTimes(parent)
    this._rem(path)
}

Fs.prototype.unlinkSync = function (path) {
    if (!this.existsSync(path)) throw FsError('ENOENT')

    var item = this._get(path)
    if (item.isDirectory()) throw FsError('EISDIR')

    var parent = this._get(dirname(path))
    updateTimes(parent)
    this._rem(path)
}

Fs.prototype.renameSync = function (oldPath, newPath) {
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

;['readdir', 'stat', 'rmdir', 'unlink'].forEach(function (meth) {
    var sync = meth + 'Sync'
    Fs.prototype[meth] = function (p, cb) {
        var res, err
        try {
            res = this[sync].call(this, p)
        } catch (e) {
            err = e
        }
        cb && cb(err, res)
    }
})

Fs.prototype.readFile = function (filename, encoding, cb) {
    if (typeof encoding != 'string') {
        cb = encoding
        encoding = undefined
    }
    var res, err
    try {
        res = this.readFileSync(filename, encoding)
    } catch (e) {
        err = e
    }
    cb && cb(err, res)
}

Fs.prototype.writeFile = function (filename, data, encoding, cb) {
    if (typeof encoding == 'function') {
        cb = encoding
        encoding = null
    }
    encoding = encoding || 'utf8'
    var err
    try {
        this.writeFileSync(filename, data, encoding)
    } catch (e) {
        err = e
    }
    cb && cb(err)
}

Fs.prototype.exists = function (path, cb) {
    cb && cb(this.existsSync(path))
}

Fs.prototype.mkdir = function (dir, mode, cb) {
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

Fs.prototype.rename = function (oldPath, newPath, cb) {
    var res, err
    try {
        res = this.renameSync(oldPath, newPath)
    } catch (e) {
        err = e
    }
    cb && cb(err, res)
}

Fs.prototype.patch = function () {
    this._orig = {}
    var fs = require('fs')
    methods.forEach(function (meth) {
        this._orig[meth] = fs[meth]
        fs[meth] = this[meth].bind(this)
    }, this)
}

Fs.prototype.unpatch = function () {
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
    'rmdir',
    'unlink',
    'rename'
].reduce(function (res, meth) {
    res.push(meth)
    res.push(meth + 'Sync')
    return res
}, [])

Fs.prototype.at = function (path) {
    return new Proxy(this, path)
}

function Proxy (fs, path) {
    this.fs = fs
    this.path = path
}

Proxy.prototype.dir = function (p) {
    p = join(this.path, p)
    this.fs.dir.apply(this.fs, arguments)
    return this
}

Proxy.prototype.file = function (p) {
    p = join(this.path, p)
    this.fs.file.apply(this.fs, arguments)
    return this
}

Proxy.prototype.at = function (p) {
    p = join(this.path, p)
    return this.fs.at.apply(this.fs, arguments)
}

function updateTimes (stat) {
    var now = new Date
    stat.mtime = now
    stat.ctime = now
}

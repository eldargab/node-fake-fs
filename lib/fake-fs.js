var stat = require('./stat')
var PATH = require('path')
var normalize = PATH.normalize
var join = PATH.join
var dirname = PATH.dirname

function resolve (p) {
    return PATH.resolve(p).replace('\\', '/') // Windows support
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
    return this._add(resolve(path), new stat.Dir(opts))
}

Fs.prototype.file = function (path, content, encoding) {
    return this._add(resolve(path), new stat.File(content, encoding))
}

Fs.prototype.at = function (path) {
    return {
        _fs: this,

        dir: function (p) {
            p = join(path, p)
            this._fs.dir.apply(this._fs, arguments)
            return this
        },

        file: function (p) {
            p = join(path, p)
            this._fs.file.apply(this._fs, arguments)
            return this
        }
    }
}

Fs.prototype._add = function (path, item) {
    var segs = path.split('/'); segs.shift()
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
    var segs = resolve(path).split('/'); segs.shift()
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
    this.file(filename, data, encoding)
}

Fs.prototype.mkdirSync = function (dir, mode) {
    if (this.existsSync(dir)) throw FsError('EEXIST')
    var parent = this._get(dirname(dir))
    if (!parent.isDirectory()) throw FsError('ENOTDIR')
    this.dir(dir)
}

;['readdir', 'stat'].forEach(function (meth) {
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

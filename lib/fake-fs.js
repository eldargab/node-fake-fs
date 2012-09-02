var stat = require('./stat')
var normalize = require('path').normalize

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
    var segs = path.split('/')
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
    path = normalize(path).replace('\\', '/') // windows support
    var segs = path.split('/')
    var item = this.root
    if (segs[0] == '.') return item
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

Fs.prototype.exists = function (path, cb) {
    cb && cb(this.existsSync(path))
}

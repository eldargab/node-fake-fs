function mix (target, src) {
    for (var key in src) {
        target[key] = src[key]
    }
}

function stat (Klass, props) {
    Klass.prototype = {
        isDirectory: function () {
            return false
        },
        isFile: function () {
            return false
        }
    }
    mix(Klass.prototype, props)
    return Klass
}


exports.Dir = stat(function Dir (opts) {
    mix(this, opts)
    this.childs = {}
}, {
    isDirectory: function () {
        return true
    },

    toString: function () {
        return 'directory'
    }
})


exports.File = stat(function File (content, encoding) {
    if (typeof content == 'string') {
        this.content = content
        this.encoding = encoding
    } else if (Buffer.isBuffer(content)) {
        this.content = content
    } else {
       mix(this, content)
    }
    if (this.content != null &&
        typeof this.content != 'string' &&
        !Buffer.isBuffer(this.content)) {
        throw new Error('File content can be a string or buffer')
    }
}, {
    isFile: function () {
        return true
    },

    read: function (encoding) {
        return encoding
            ? this._buffer().toString(encoding)
            : this._buffer()
    },

    _buffer: function () {
        if (Buffer.isBuffer(this.content)) return this.content
        return this.content = new Buffer(this.content || '', this.encoding || 'utf8')
    },

    toString: function () {
        return 'file'
    }
})
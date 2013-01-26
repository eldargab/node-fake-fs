var should = require('should')
var Fs = require('..')

function Cb () {
    var err, res, called = 0

    function cb (_err, _res) {
        err = _err
        res = _res
        called++
    }

    cb.result = function () {
        called.should.equal(1)
        should.not.exist(err)
        return res
    }

    cb.error = function (code) {
        called.should.equal(1)
        should.exist(err)
        err.should.have.property('code').equal(code)
    }

    return cb
}

describe('Fake FS', function () {
    var fs, cb

    beforeEach(function () {
        fs = new Fs
        cb = Cb()
    })

    function snapshotTimes (p) {
        var stat = fs.statSync(p)
        return {
            mtime: stat.mtime,
            atime: stat.atime,
            ctime: stat.ctime
        }
    }

    function testTimes (p, fn, cb) {
        var before = snapshotTimes(p)
        setTimeout(function () {
            fn()
            var now = snapshotTimes(p)
            cb(before, now)
        })
    }

    function testTimesUpdated (p, fn, done) {
        testTimes(p, fn, function (before, now) {
            now.mtime.should.be.above(before.mtime)
            now.mtime.should.be.equal(now.ctime)
            done()
        })
    }

    describe('.dir(path, [opts])', function () {
        it('Should define dir', function () {
            fs.dir('a/b/c').statSync('a/b/c').isDirectory().should.be.true
        })

        it('Should support options', function () {
            var stat = fs.dir('a', {
                mtime: 10,
                atime: 30
            }).statSync('a')
            stat.should.have.property('mtime').equal(10)
            stat.should.have.property('atime').equal(30)
        })

        it('Should work like mkdir -p', function () {
            fs.dir('a', { mtime: 100 })
            fs.dir('a/b/c')
            fs.statSync('a').mtime.should.equal(100)
            fs.statSync('a/b').isDirectory().should.be.true
        })
    })

    describe('.file(path, [opts | content, [encoding]]', function () {
        it('Should define file', function () {
            fs.file('a/b.txt').statSync('a/b.txt').isFile().should.be.true
        })

        it('Should work like mkdir -p for parent dir', function () {
            fs.dir('a', { mtime: 100 })
            fs.file('a/b.txt')
            fs.statSync('a').mtime.should.equal(100)
        })

        it('Should support content & encoding params', function () {
            fs.file('hello.txt', 'hello')
                .readFileSync('hello.txt', 'utf8')
                .should.equal('hello')

            fs.file('bin', 'TWFu', 'base64')
                .readFileSync('bin', 'utf8').should.equal('Man')

            fs.file('bin2', new Buffer([10]))
            fs.readFileSync('bin2')[0].should.equal(10)
        })

        it('Should support options param', function () {
            fs.file('hello.txt', {
                atime: 10,
                mtime: 20,
                content: 'a'
            })
            var stat = fs.statSync('hello.txt')
            stat.should.have.property('atime').equal(10)
            stat.should.have.property('mtime').equal(20)
            fs.readFileSync('hello.txt')[0].should.equal(97)
        })
    })

    describe('.at(path)', function () {
        it('Returns proxy for defining items prefixed with `path`', function () {
            fs.at('home')
                .file('.gitignore')
                .dir('.local')
                .at('eldar')
                    .dir('dev')
            fs.statSync('home/.gitignore').isFile().should.be.true
            fs.statSync('home/.local').isDirectory().should.be.true
            fs.statSync('home/eldar/dev').isDirectory().should.be.true
        })
    })


    describe('.stat()', function () {
        it('Should return stats', function () {
            fs.file('a/b/c', {ctime: 123}).stat('a/b/c', cb)
            cb.result().should.have.property('ctime').equal(123)
        })

        it('Should throw ENOENT on non-existent path', function () {
            fs.stat('undefined', cb)
            cb.error('ENOENT')
        })

        it('Should support absolute paths', function () {
            fs.dir('a')
            fs.stat(process.cwd(), cb)
            cb.result().should.equal(fs.statSync('.'))
        })
    })

    describe('.readdir()', function () {
        it('Should list a dir contents', function () {
            fs.dir('a').file('b.txt').readdir('.', cb)
            cb.result().should.eql(['a', 'b.txt'])
        })

        it('Should throw ENOENT on non-existent path', function () {
            fs.readdir('a', cb)
            cb.error('ENOENT')
        })

        it('Should throw ENOTDIR on non-dir', function () {
            fs.file('a.txt').readdir('a.txt', cb)
            cb.error('ENOTDIR')
        })
    })

    describe('.exists()', function () {
        it('Should return true on existent path', function (done) {
            fs.dir('asd').exists('asd', function (exists) {
                exists.should.be.true
                done()
            })
        })

        it('Should return false for non-existent path', function (done) {
            fs.exists('non-existent', function (exists) {
                exists.should.be.false
                done()
            })
        })

        it('Should return true for root path', function (done) {
            fs.exists('/', function (exists) {
                exists.should.be.true
                done()
            })
        })
    })

    describe('.mkdir()', function () {
        it('Should create dir', function () {
            fs.dir('.').mkdir('a', cb)
            cb.result()
            fs.statSync('a').isDirectory().should.be.true
        })

        it('Should ignore mode', function () {
            fs.dir('.').mkdir('a', 0777, cb)
            cb.result()
            fs.statSync('a').isDirectory().should.be.true
        })

        it('Should throw EEXIST on existing item', function () {
            fs.dir('a').mkdir('a', cb)
            cb.error('EEXIST')
        })

        it('Should throw ENOENT on non-existent parent', function () {
            fs.mkdir('a', cb)
            cb.error('ENOENT')
        })

        it('Should throw ENOTDIR on non-dir parent', function () {
            fs.file('a').mkdir('a/b', cb)
            cb.error('ENOTDIR')
        })

        it('Should update parent times', function (done) {
            fs.dir('.')
            testTimesUpdated('.', function () {
                fs.mkdir('dir')
            }, done)
        })
    })

    describe('.rmdir()', function () {
        it('Should remove an existing direcory', function () {
            fs.dir('a/b')
            fs.rmdirSync('a/b')
            fs.existsSync('a/b').should.be.false
        })

        it('Should remove an existing direcory, its subdirectories and files', function () {
            fs.dir('a/b/c')
            fs.file('a/b/file.txt')
            
            fs.rmdirSync('a/b')

            fs.existsSync('a/b/c').should.be.false
            fs.existsSync('a/b/file.txt').should.be.false
            fs.existsSync('a/b').should.be.false

            fs.existsSync('a').should.be.true
        })

        it('Should throw an ENOTDIR error on file', function () {
            fs.file('a/file.txt')

            fs.rmdir('a/file.txt', cb)

            cb.error('ENOTDIR')
        })

        it('Should update dir times on directory removal', function (done) {
            fs.dir('a/b')
            
            testTimesUpdated('a', function () {
                fs.rmdir('a/b')
            }, done)
        })
    })

    describe('.unlink()', function () {
        it('Should remove an existing file', function () {
            fs.file('a/file.txt')

            fs.unlinkSync('a/file.txt')
            
            fs.existsSync('a/file.txt').should.be.false
        })

        it('Should throw an EISDIR error on directory', function () {
            fs.dir('a/b')

            fs.unlink('a/b', cb)

            cb.error('EISDIR')
        })

        it('Should update dir times on file removal', function (done) {
            fs.file('a/file.txt')

            testTimesUpdated('a', function () {
                fs.unlink('a/file.txt')
            }, done)
        })
    })

    describe('.readFile()', function () {
        it('Should read file contents', function () {
            var content = new Buffer([1, 2, 3])
            fs.file('bin', content).readFile('bin', cb)
            cb.result().should.equal(content)
        })

        it('Should decode file contents', function () {
            fs.file('file.txt', new Buffer([97])).readFile('file.txt', 'ascii', cb)
            cb.result().should.equal('a')
        })

        it('Should throw ENOENT on non-existent file', function () {
            fs.readFile('foo', cb)
            cb.error('ENOENT')
        })

        it('Should throw EISDIR on directory', function () {
            fs.dir('dir').readFile('dir', cb)
            cb.error('EISDIR')
        })
    })

    describe('.writeFile()', function () {
        it('Should write file', function () {
            fs.dir('.').writeFile('a', 'hello', cb)
            cb.result()
            fs.readFileSync('a', 'utf8').should.equal('hello')
        })

        it('Should respect encoding', function () {
            fs.dir('.').writeFile('a', 'TWFu', 'base64', cb)
            cb.result()
            fs.readFileSync('a', 'utf8').should.equal('Man')
        })

        it('Should allow to write buffers', function () {
            fs.dir('.').writeFile('a', new Buffer([10]), cb)
            cb.result()
            fs.readFileSync('a')[0].should.equal(10)
        })

        it('Should throw ENOTDIR when parent is not a dir', function () {
            fs.file('a').writeFile('a/b', '', cb)
            cb.error('ENOTDIR')
        })

        it('Should throw ENOENT whent parent dir does not exist', function () {
            fs.writeFile('a', '', cb)
            cb.error('ENOENT')
        })

        it('Should update dir times on file creation', function (done) {
            fs.dir('.')
            testTimesUpdated('.', function () {
                fs.writeFile('a')
            }, done)
        })

        it('Should not update dir times on file update', function (done) {
            fs.file('a')
            testTimes('.', function () {
                fs.writeFile('a', 'a')
            }, function (before, now) {
                before.should.eql(now)
                done()
            })
        })
    })

    describe('.patch()', function () {
        afterEach(function () {
            fs.unpatch()
        })
        it('Should patch global fs with self methods', function () {
            var global = require('fs')
            var origStat = global.stat
            fs.patch()
            global.statSync.should.not.equal(origStat)
            global.existsSync('abrakadabra').should.be.false
            fs.dir('abrakadabra')
            global.existsSync('abrakadabra').should.be.true
        })
    })

    describe('.unpatch()', function () {
        it('Should restore original fs methods', function () {
            var global = require('fs')
            var origStat = global.stat
            fs.patch()
            origStat.should.not.equal(global.stat)
            fs.unpatch()
            origStat.should.equal(global.stat)
        })
    })
})
require('dotenv').config();
var fuse = require('fuse-bindings');
const fs = require('fs');
const uuid = require('uuid/v4');
const AWS = require('aws-sdk');

const mountPath = `${__dirname}/mnt-${uuid()}`;

fs.mkdirSync(mountPath);

// const str = "hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds hello worlds ";
const S3 = new AWS.S3({apiVersion: '2006-03-01'});

// var mountPath = process.platform !== 'win32' ? './mnt' : 'M:\\'
 
function adjustPath(path){

	if(path.startsWith('/')){
		path = path.slice(1, path.length);
		console.log('adj', path);
	}

	return path;

}

fuse.mount(mountPath, {
  readdir: function (path, cb) {
    console.log('readdir(%s)', path)
    if (path === '/') {

       new Promise( (resolve, reject) => {

            const pathPrefix = path === '/' ? '' : path;

            var params = {
                Bucket: process.env.BUCKET_NAME,
                Prefix : pathPrefix
            };
            
            console.log('readdir params:', params);

            S3.listObjects(params, (err, data) => {
                if (err) { 

                    console.log('listObjects err', err, params); 
                    // cb(0, []);
                    reject();
                
                } else {

                    console.log(data);
                    const files = data.Contents.map(obj => { return `${obj.Key}` } );

                    resolve(files);

                };
            });

        })
        .then(files => {
            cb(0, files);
        })
        ;

        // return cb(0, ['edinburgh.txt', 'banana.jpg'])
    } else {
        cb(0);
    }
  },
  getattr: function (path, cb) {
    console.log('getattr(%s)', path)
    if (path === '/') {
      cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 1,
        size: 100,
        mode: 16877,
        uid: process.getuid ? process.getuid() : 0,
        gid: process.getgid ? process.getgid() : 0
      })
      return;
    } else  {
      /*cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 1,
        size: str.length,
        mode: 33188,
        uid: process.getuid ? process.getuid() : 0,
        gid: process.getgid ? process.getgid() : 0
      })
      return;*/

			S3.headObject({
				Bucket: process.env.BUCKET_NAME,
				Key : adjustPath(path)
			}, function(err, data) {

				if(err){
					cb(0, {
						mtime: new Date(),
						atime: new Date(),
						ctime: new Date(),
						nlink: 1,
						size: 0,
						mode: 33188,
						uid: process.getuid ? process.getuid() : 0,
						gid: process.getgid ? process.getgid() : 0
					});
					return;
				} else {
					cb(0, {
						mtime: new Date(),
						atime: new Date(),
						ctime: new Date(),
						nlink: 1,
						size: data.ContentLength,
						mode: 33188,
						uid: process.getuid ? process.getuid() : 0,
						gid: process.getgid ? process.getgid() : 0
					})
				}

			});
      

    }
 
    // cb(fuse.ENOENT)
  },
  open: function (path, flags, cb) {
    console.log('open(%s, %d)', path, flags)
    cb(0, 42); // 42 is an fd
  },
  read: function (path, fd, buf, len, pos, cb) {
    console.log('read(%s, %d, %d, %d)', path, fd, len, pos)
    // var str = 'hello world\n'.slice(pos, pos + len)
    /*if (!str) {
			return cb(0)
		}*/

		console.log('newStr range:', pos, len, pos + len);
		// process.exit();
		/*const newStr = str.slice(pos, pos + len);
    buf.write(newStr);
		return cb(newStr.length)*/
		const params = {
			Bucket: process.env.BUCKET_NAME,
			Key: adjustPath(path),
			Range : `bytes=${pos}-${pos + len}`
		};
		
		S3.getObject(params, (err, data) => {

			if(err){
				return cb(0);
			} else {
				// buf.copy(data.Body);
				/*const B = data.Body.toString('utf8');
				console.log('data.Body:', data.Body);
				buf.write(B);*/

				// buf.copy(data.Body, 0, pos, pos + len);
				data.Body.copy(buf, 0, 0, data.Body.length);
				return cb(buf.length);

				// return cb(B.length);
			}

		});

  }
}, function (err) {
  if (err) throw err
  console.log('filesystem mounted on ' + mountPath)
})
 
process.on('SIGINT', function () {
  fuse.unmount(mountPath, function (err) {
    if (err) {
      console.log('filesystem at ' + mountPath + ' not unmounted', err)
    } else {
      console.log('filesystem at ' + mountPath + ' unmounted')
    }

    console.log(`RMing ${mountPath}`);
    fs.rmdirSync(mountPath);

  })
})
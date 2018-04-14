require('dotenv').config();
const debug = require('debug')('index');
const fuse = require('fuse-bindings');
const AWS = require('aws-sdk');

const mountPath = `${__dirname}/mnt`;

const S3 = new AWS.S3({apiVersion: '2006-03-01'});

const cache = {};

function adjustPath(path){

	if(path.startsWith('/')){
		path = path.slice(1, path.length);
		debug('adj', path);
	}

	return path;

}

// unmount();

fuse.mount(mountPath, {
	readdir: function (path, cb) {
		console.log('readdir(%s)', path)
	//   if (path === '/') return cb(0, ['hello.jpg'])
	//   cb(0)

		var params = {
			Bucket: process.env.BUCKET_NAME,
			Prefix : path === '/' ? '' : path
		};

		S3.listObjects(params, (err, data) => {
			if (err) { 
				debug('listObjects err', err, params); 
				cb(0);
			} else {
				debug(data);
				const files = data.Contents.map(obj => { return `${obj.Key}` } );

				debug('>>>>>>>>>>>>>> Files:', files);
				debug('>>>>>>>>>>>>>> Files:', files);
				debug('>>>>>>>>>>>>>> Files:', files);
				debug('>>>>>>>>>>>>>> Files:', files);
				debug('>>>>>>>>>>>>>> Files:', files);

				if(files.length === 0){
					cb(0);
				} else {
					cb(0, files);
				}


			};
		});

	},
	getattr: function (path, cb) {
	  console.log('getattr(%s)', path)
		
	  S3.headObject({
			Bucket: process.env.BUCKET_NAME,
			Key : adjustPath(path)
		}, function(err, data) {
			if (err){
				debug(`getAttr headObject:`, err); // an error occurred
				// cb(0, fuse.ENOENT);
				cb(0, {
					mtime: new Date(),
					atime: new Date(),
					ctime: new Date(),
					nlink: 1,
					size: 0,
					mode: path.endsWith('/') ? 16877 : 33188,
					uid: process.getuid ? process.getuid() : 0,
					gid: process.getgid ? process.getgid() : 0
				})
			} else {
				debug(`S3 Data (${path}):`, data);
				cb(0, {
					mtime: new Date(),
					atime: new Date(),
					ctime: new Date(),
					nlink: 1,
					size: data.ContentLength,
					mode: path.endsWith('/') ? 16877 : 33188,
					uid: process.getuid ? process.getuid() : 0,
					gid: process.getgid ? process.getgid() : 0
				})
			}
		})
		;
	},
	open: function (path, flags, cb) {
	  console.log('open(%s, %d)', path, flags)
	  cb(0, 42) // 42 is an fd
	},
	read: function (path, fd, buffer, length, position, cb) {
	//   console.log('read(%s, %d, %d, %d)', path, fd, len, pos)
	//   var str = 'hello world\n'.slice(pos, pos + len)
	//   if (!str) return cb(0)
	//   buf.write(str)
	//   return cb(str.length)

		path = adjustPath(path);
		
		var params = {
			Bucket: process.env.BUCKET_NAME,
			Key: path,
			// Range : `bytes=${position}-${position + length}`
		};
		
		S3.getObject(params, function(err, data) {

			if(data !== null){
				debug('dahta:', data);
				// process.exit();
			}


			// var str = 'hello world\n'.slice(pos, pos + len)
			
			if(data){
				if(data.Body){
					
					if(cache[path] === undefined){
						cache[path] = data.Body;
					}

					debug('buf:', buffer);
					console.log('read(%s, %d, %d, %d)', path, buffer, length, position)

					// buf.write(data.Body.slice(pos, pos + len));
					// return cb(data.Body.length);

					if (position >= data.length){
						delete cache[path];
						return cb(0) // done
					} else {
						var part = cache[path].slice(position, position + length)
						part.copy(buffer) // write the result of the read to the result buffer
						cb(part.length)	
					}

				}
			} else {
				return cb(0)
			} 

		});

	},
	/*write : function(path, fd, buffer, length, position, cb){
		
		path = adjustPath(path);

		if(position === 0){
			cache[path] = Buffer.alloc(length);
		}

		for(var x = position; x < buffer.length; x ++){
			cache[path][x] = buffer[x];
		}

		if(position >= length){

			const params = {
				Bucket : process.env.BUCKET_NAME,
				Key : path,
				Body: cache[path]
			};
	
			S3.putObject(params, (err, data) => {
	
				if(err){
					debug('PUTOBJECT ERR:', err);
				}
	
				cb(length); // we handled all the data
				
			});

		}

	}*/
  }, function (err) {
	if (err) {
		debug(err);
		unmount();
	}
	console.log('filesystem mounted on ' + mountPath)
  })



function unmount(exit = true){
	fuse.unmount(mountPath, function (err) {
		if (err) {
		  debug('filesystem at ' + mountPath + ' not unmounted', err);
		} else {
		  debug('filesystem at ' + mountPath + ' unmounted')
		}
		if(exit){
			process.exit();
		}
	});
}
process.on('SIGINT', function(err){
	debug('err:', err);
	unmount();
});

process.on('uncaughtException', function(err){
	debug('err:', err);
	unmount();
});
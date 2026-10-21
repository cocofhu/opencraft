#!/usr/bin/env node
import { mkdir, lstat, chown, realpath, readdir, open } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
const exec=promisify(execFile);
const directory=process.argv[2];
if(process.getuid()!==0||!directory?.startsWith('/')||directory==='/'||resolve(directory)!==directory||process.argv.length!==3)throw Error('Usage (root): prepare-volumes.mjs /private/observation-directory');
await mkdir(directory,{recursive:true,mode:0o700});
const root=await lstat(directory);
if(!root.isDirectory()||root.isSymbolicLink()||root.uid!==0||(root.mode&0o077)!==0||await realpath(directory)!==directory)throw Error('Observation directory must be a private root-owned physical directory');
for(const [name,size] of [['prometheus',10],['loki',5],['data',1]]) {
  const path=join(directory,name),image=join(directory,`${name}.ext4`);
  await mkdir(path,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});
  const info=await lstat(path);if(!info.isDirectory()||info.isSymbolicLink())throw Error('Mount target must be a physical directory');
  let exists=false;try{const info=await lstat(image);if(!info.isFile()||info.isSymbolicLink()||info.uid!==0||(info.mode&0o077)!==0||info.size!==size*1073741824)throw Error('Existing image does not match quota');exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  const mounted=await exec('findmnt',['-rn','--mountpoint',path,'-o','SOURCE']).catch(error=>{if(error.code===1)return null;throw error;});
  if(mounted){
    if(!exists)throw Error('Unexpected mounted filesystem');
    const backing=await exec('losetup',['--noheadings','--output','BACK-FILE',mounted.stdout.trim()]);
    if(await realpath(backing.stdout.trim())!==image)throw Error('Mount belongs to another filesystem');
  } else {
    if((await readdir(path)).length)throw Error('Refusing to mount over existing files');
    if(!exists){const file=await open(image,'wx',0o600);try{await file.truncate(size*1073741824);}finally{await file.close();}await exec('mkfs.ext4',['-q','-m','0',image]);}
    await exec('mount',['-o','loop,nosuid,nodev,noexec',image,path]);
  }
  await chown(path,name==='data'?0:name==='loki'?10001:65534,name==='data'?0:name==='loki'?10001:65534);
}
console.log(JSON.stringify({directory,filesystems:['prometheus','loki','data'],note:'Persist these own-image mounts with systemd mount units before enabling the container stack.'}));

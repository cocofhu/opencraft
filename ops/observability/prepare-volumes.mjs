#!/usr/bin/env node
import { mkdir, lstat, chmod, chown } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
const exec=promisify(execFile);
const directory=process.argv[2];
if(process.getuid()!==0||!directory?.startsWith('/')||directory==='/'||process.argv.length!==3)throw Error('Usage (root): prepare-volumes.mjs /private/observation-directory');
await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
for(const [name,size] of [['prometheus',10],['loki',5],['data',1]]) {
  const path=join(resolve(directory),name),image=join(resolve(directory),`${name}.ext4`);
  await mkdir(path,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});
  let exists=false;try{const info=await lstat(image);if(!info.isFile()||info.isSymbolicLink()||info.size!==size*1073741824)throw Error('Existing image does not match quota');exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!exists){await exec('truncate',['-s',`${size}G`,image]);await chmod(image,0o600);await exec('mkfs.ext4',['-q','-m','0',image]);}
  const mounted=await exec('findmnt',['-rn','--mountpoint',path,'-o','SOURCE']).catch(()=>null);
  if(!mounted)await exec('mount',['-o','loop,nosuid,nodev,noexec',image,path]);
  await chown(path,name==='data'?0:name==='loki'?10001:65534,name==='data'?0:name==='loki'?10001:65534);
}
console.log(JSON.stringify({directory,filesystems:['prometheus','loki','data'],note:'Persist these own-image mounts with systemd mount units before enabling the container stack.'}));

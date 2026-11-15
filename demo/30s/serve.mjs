import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('./recorder.html',import.meta.url));
createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html;charset=utf-8','cache-control':'no-store'});res.end(html);}).listen(5278,'127.0.0.1',()=>console.log('Demo recorder: http://127.0.0.1:5278/'));

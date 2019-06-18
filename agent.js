// 1.モジュールオブジェクトの初期化
const execa = require('execa');
const iconv = require("iconv-lite");
var path = require('path');
var cfg = require('./package.json');

var fs = require("fs");
var server = require("http").createServer(function(req, res) {
     res.writeHead(200, {"Content-Type":"text/html"});
     var output = fs.readFileSync("./index.html", "utf-8");
     res.end(output);
}).listen(2019);
var io = require("socket.io").listen(server);

// ユーザ管理ハッシュ
var userHash = {};

    let command = "cmd";
    let args = [];

    console.log("path:"+path.dirname(__dirname));


// 2.イベントの定義
io.on("connection", function (socket) {

  // 接続開始カスタムイベント(接続元ユーザを保存し、他ユーザへ通知)
  socket.on("connected", function (name) {
    userHash[socket.id] = {name:name};
    let child = userHash[socket.id]['childprocess'] = execa(command, args, {
          cwd: path.dirname(__dirname),//__dirname,
          stdio: ['pipe', 'pipe', 'pipe'],
          //shell: true,
          env: process.env,
        })

    let msg = name + "タスクが起動しました"+'pid:'+ child.pid;
    console.log('pid:'+ child.pid)
    console.log('address:'+ socket.handshake.address.address)
    console.log('remoteAddress:'+ socket.request.connection.remoteAddress)

    socket.emit("publish", {value: msg});


    child.stdout.on('data', buffer => {
      if (process.platform === 'win32') {
          buffer = iconv.decode(buffer, "windows-31j");
      }
      console.log(buffer.toString());
      socket.emit("publish", {value: buffer.toString()});
    })

    child.stderr.on('data', buffer => {
      if (process.platform === 'win32') {
          buffer = iconv.decode(buffer, "windows-31j");
      }
      console.log(buffer.toString());
      socket.emit("publish", {value: buffer.toString()});
    })
    child.on('exit', (code, signal) => {
      console.log('Task exit', command, args, 'code:', code, 'signal:', signal)
     })

    child.on('error', error => {
     console.error(error)
     socket.emit("publish", {value: error.message.toString()});
    });

    child.on('close', (code) => {
      let msg =`child process exited with code ${code}`;
      console.log(msg);
      socket.emit("publish", {value: msg});
    });



  });

  // メッセージ送信カスタムイベント
  socket.on("publish", function (data) {
    let child = userHash[socket.id]['childprocess']
    child.stdin.write(data.value+"\n");
    socket.emit("publish", {value:data.value});
  });

  // 接続終了組み込みイベント(接続元ユーザを削除し、他ユーザへ通知)
  socket.on("disconnect", function () {
    if (userHash[socket.id]) {
      var msg = userHash[socket.id]['name'] + "が退出しました";
      let child = userHash[socket.id]['childprocess'];
      child.stdin.end();
      delete userHash[socket.id];
      io.sockets.emit("publish", {value: msg});
    }
  });
});
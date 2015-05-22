var express = require('express'),
    app = express(),
    io = require('socket.io')(app.listen(3006)),
    path = require('path');

var Scene = require('./scene'),
    Player = require('./player');

app.use(express.static(path.join(__dirname, 'public'), {maxAge: 86400000}));

var scene = new Scene();

setInterval(function(){

    scene.render();
    
}, 50);

io.on('connection', function (socket) {

    var player = new Player(10, Math.floor(scene.width * Math.random()), Math.floor(scene.height * Math.random()));
    if(!scene.add(player, socket)){
        var buffer = new Buffer(1);
        buffer.writeInt8(4, 0); // 满了
        socket.send(buffer);
        return;
    }

    socket.binaryType = 'arraybuffer';

    var buffer = new Buffer(17);
    buffer.writeInt8(1, 0); // 初始化
    // Map
    buffer.writeUInt16BE(scene.width, 1); // size
    buffer.writeUInt16BE(scene.height, 3); // size
    // Hero
    buffer.writeUInt16BE(player.id, 5); // id
    buffer.writeUInt16BE(player.size, 7); // size
    buffer.writeFloatBE(player.x, 9); // x
    buffer.writeFloatBE(player.y, 13); // x
    socket.send(buffer);

    socket.on('message', function(buffer){
        var type = buffer.readUInt8(0);
        switch(type){
            case 1:
                player.lastTime = Date.now();
                break;
            case 16:
                var X = buffer.readInt32BE(1),
                    Y = buffer.readInt32BE(5);
                player.X = X;
                player.Y = Y;
                break;
        }
    });

    socket.on('disconnect', function(){
        scene.remove(player);
    });

});
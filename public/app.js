DataView.prototype.getUTF8String = function(offset, length) {
    var utf16 = new ArrayBuffer(length * 2);
    var utf16View = new Uint16Array(utf16);
    for (var i = 0; i < length; ++i) {
        utf16View[i] = this.getUint8(offset + i);
    }
    return String.fromCharCode.apply(null, utf16View);
};
CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius, fill, stroke) {  
    if (typeof stroke == "undefined") {  
        stroke = true;  
    }  
    if (typeof radius === "undefined") {  
        radius = 5;  
    }
    x = x - width * 0.5;
    y = y - height * 0.5;
    this.beginPath();  
    this.moveTo(x + radius, y);  
    this.lineTo(x + width - radius, y);  
    this.quadraticCurveTo(x + width, y, x + width, y + radius);  
    this.lineTo(x + width, y + height - radius);  
    this.quadraticCurveTo(x + width, y + height, x + width - radius, y+ height);  
    this.lineTo(x + radius, y + height);  
    this.quadraticCurveTo(x, y + height, x, y + height - radius);  
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);  
    this.closePath();  
    if (stroke) {  
        this.stroke();  
    }  
    if (fill) {  
        this.fill();  
    }  
};  

function Map(width, height){
    this.width = width;
    this.height = height;
    this.foodPool = [];
}

function Player(id, size, x, y){
    this.id = id;
    this.size = size || 10;
    this.x = x || 0;
    this.y = y || 0;
    this.__x = this.x;
    this.__y = this.y;
}

function Hero(socket, id, size, x, y){
    this.socket = socket;
    Player.call(this, id, size, x, y);
}

Hero.prototype = Object.create(Player.prototype);

(function () {
    var hero, map, players = [], viewPlayers = [];

    function findOne(id){

        for(var i = 0; i < players.length; i++){
            var player = players[i];
            if(id === player.id){
                return player;
            }
        }
        return false;

    }

    var socket = io.connect();
    socket.binaryType = 'arraybuffer';

    socket.on('message', function(buffer){
        var dataView = new DataView(buffer);
        var type = dataView.getUint8(0);
        switch(type){
            case 1:
                console.log('init');
                map = new Map( dataView.getUint16(1), dataView.getUint16(3) );
                hero = new Hero( socket, dataView.getUint16(5), dataView.getUint16(7), dataView.getFloat32(9), dataView.getFloat32(13) );
                hero.color = 'rgba(' + ((Math.random() * 255) | 0) + ', ' + ((Math.random() * 255) | 0) + ', ' + ((Math.random() * 255) | 0) + ', 1)';
                break;
            case 2:
                var number = dataView.getUint16(1);
                timestamp = Date.now();
                viewPlayers = [];
                for(var i = 0; i < number; i ++){
                    var id = dataView.getUint16(3 + i * 12),
                        size = dataView.getUint16(5 + i * 12),
                        x = dataView.getFloat32(7 + i * 12),
                        y = dataView.getFloat32(11 + i * 12);
                    // console.log(x,y)
                    var player;
                    if(id === hero.id){
                        player = hero;
                    }else{
                        
                        player = findOne(id);
                        if(!player) {
                            player = new Player(id, size, x, y);
                            players.push(player);
                        }else if(Math.abs(player.x - x) > 30 || Math.abs(player.y - y) > 30){
                            var ind = players.indexOf(player);
                            ind !== -1 && players.splice(ind, 1);
                            player = new Player(id, size, x, y);
                            players.push(player);
                        }

                    }
                    
                    player.oSize = size;
                    player.nSize = size;
                    player.ox = x;
                    player.oy = y;
                    player.nx = x;
                    player.ny = y;

                    player.updateTime = timestamp;

                    viewPlayers.push(player);
                }
                var len = number * 12 + 3;
                number = dataView.getUint16(len);
                map.foodPool = [];
                for(var i = 0; i < number; i ++){

                    var x = dataView.getFloat32(len + 2 + i * 8),
                        y = dataView.getFloat32(len + 6 + i * 8);

                    map.foodPool.push({x: x, y: y});

                }
                break;
            case 3:
                alert('你被吃掉了！');
                break;
            case 4:
                alert('服务器爆满！');
                break;
        }
    });

    var X = Y = 0,
        width = 600, height = 300,
        ratio = 1, timestamp = 0;

    var canvas = document.getElementById('canvas'),
        ctx = canvas.getContext('2d');

    if (window.devicePixelRatio > 1) {
        var canvasWidth = canvas.width;
        var canvasHeight = canvas.height;

        canvas.width = canvasWidth * window.devicePixelRatio;
        canvas.height = canvasHeight * window.devicePixelRatio;
        canvas.style.width = canvasWidth;
        canvas.style.height = canvasHeight;

        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    setInterval(function(){

        if(!hero || !map) return;
        var arrayBuffer = new ArrayBuffer(9),
            dataView = new DataView(arrayBuffer);

        var x = X - width * 0.5,
            y = Y - height * 0.5;

        dataView.setUint8(0, 16);
        dataView.setInt32(1, Math.abs(x) < hero.size ? 0 : x);
        dataView.setInt32(5, Math.abs(y) < hero.size ? 0 : y);

        socket.send(arrayBuffer);

    }, 100);


    setInterval(function(){

        if(!hero || !map) return;
        var arrayBuffer = new ArrayBuffer(1),
            dataView = new DataView(arrayBuffer);

        dataView.setUint8(0, 1);

        socket.send(arrayBuffer);

    }, 1000);

    (function anim(){
        
        render();
        requestAnimationFrame(anim);

    })();

    canvas.onmousemove = function(event) {
        var rect = canvas.getBoundingClientRect(),
            ol = rect.left,
            ot = rect.top;

        X = event.clientX - ol;
        Y = event.clientY - ot;
    };

    function render(){

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#F0F0F0';
        ctx.fillRect(0, 0, width, height);
        ctx.save();

        if(hero){
            timestamp = Date.now();
            var A = (timestamp - hero.updateTime) / 120;
            A = 0 > A ? 0 : 1 < A ? 1 : A;
            A = A * A * (3 - 2 * A);
        }

        if(map && hero){

            hero.__x = A * (hero.nx - hero.ox) + hero.ox;
            hero.__y = A * (hero.ny - hero.oy) + hero.oy;
            hero.__size = A * (hero.nSize - hero.oSize) + hero.oSize;

            hero.x += (hero.__x - hero.x) * 0.2;
            hero.y += (hero.__y - hero.y) * 0.2;
            hero.size += (hero.__size - hero.size) * 0.05;

            var px = map.width - hero.x - width * 0.5,
                py = map.height - hero.y - height * 0.5;

            ctx.strokeStyle = '#AAAAAA';
            ctx.globalAlpha = 0.3;

            var gridSize = 50;

            i = px % gridSize;
            for (;i < width;i += gridSize) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, height);
                ctx.closePath();
                ctx.stroke();
            }
            i = py % gridSize;
            for (;i < height;i += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(width, i);
                ctx.closePath();
                ctx.stroke();
            }
            ctx.restore();
            ctx.save();
        }

        if(map && map.foodPool && map.foodPool.length){
            ctx.globalAlpha = 0.3;
            for(var i = 0, l = map.foodPool.length; i < l; i++){
                var f= map.foodPool[i];
                ctx.fillStyle = '#666666';
                // ctx.fillStyle = fillStyle = 'rgba(' + (Math.random() * 255) | 0 + ', ' + (Math.random() * 255) | 0 + ', ' + (Math.random() * 255) | 0 + ', 1)';
                // ctx.arc(width * 0.5 - (hero.x - f.x), height * 0.5 - (hero.y - f.y), 5, 0, Math.PI*2, true);
                ctx.roundRect(width * 0.5 - (hero.x - f.x), height * 0.5 - (hero.y - f.y), 14, 14, 4, true, false);
            }
            ctx.restore();
            ctx.save();
        }

        viewPlayers.sort(function(a,b){
            return a.size - b.size;
        });

        for(var i = 0; i < viewPlayers.length; i ++){

            var player = viewPlayers[i];

            player.__size = A * (player.nSize - player.oSize) + player.oSize;
            player.size += (player.__size - player.size) * 0.05;

            if(player instanceof Hero){

                ctx.fillStyle = player.color;
                // ctx.fillStyle = '#FF0000';
                ctx.beginPath();
                ctx.arc(width * 0.5, height * 0.5, player.size, 0, Math.PI*2, true);
                ctx.closePath();
                ctx.fill();
                document.getElementById('console').innerText = 'id: ' + hero.id + ' | x: ' + Math.floor(hero.x) + ' | y: ' + Math.floor(hero.y) + ' | p: ' + viewPlayers.length;

            }else{

                player.__x = A * (player.nx - player.ox) + player.ox;
                player.__y = A * (player.ny - player.oy) + player.oy;

                player.x += (player.__x - player.x) * 0.2;
                player.y += (player.__y - player.y) * 0.2;

                ctx.fillStyle = '#606060';
                ctx.beginPath();
                ctx.arc(width * 0.5 - (hero.x - player.x), height * 0.5 - (hero.y - player.y), player.size, 0, Math.PI*2, true);
                ctx.closePath();
                ctx.fill();

            }

        }

    }

})();
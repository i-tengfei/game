var QuadTree = require('./node_modules/giant-quadtree/src/quadtree');

QuadTree.prototype.pruneInverse = function(left, top, width, height){
    var right = left + width,
        bottom = top + height,
        candidate,
        rejectedObjects = [];
        keptObjects = [];

    var objects = this.top.getObjects(),
        index = 0,
        length = objects.length;

    for(; index < length; index++){
        candidate = objects[index];

        if( candidate.left < left || 
            candidate.top < top || 
            (candidate.left + candidate.width) > right ||
            (candidate.top + candidate.height) > bottom){
            keptObjects.push(candidate);
        } else {
            rejectedObjects.push(candidate);
        }
    }
    if(keptObjects.length){
        this.reset(keptObjects[0].left, keptObjects[0].top);
        index = 0;
        length = keptObjects.length;
        for(; index < length; index++){
            this.insert(keptObjects[index]);
        }
    } else {
        this.reset();
    }
    
    return rejectedObjects;
};


function length(x, y){
    return Math.sqrt( x * x + y * y );
}

function clamp(x, a, b) {
    return ( x < a ) ? a : ( ( x > b ) ? b : x );
}

function Scene(width, height, maxFoods){
    this.width = width || 2048;
    this.height = height || 2048;
    this.maxFoods = maxFoods || 1024;
    this.players = [];
    this.foods = [];
    this.foodsQuadTree = new QuadTree(this.width, this.height);
    this.generateFood();
}

Scene.prototype.generateFood = function(){
    for(var i = 0; i < this.maxFoods; i ++){
        this.addFood(Math.floor(this.width * Math.random()), Math.floor(this.height * Math.random()));
    }
};

Scene.prototype.addFood = function(x, y){
    var food = {left:x-7, top:y-7, width: 14, height: 14};
    this.foodsQuadTree.insert(food);
    this.foods.push(food);
};

Scene.prototype.findOne = function(id){
    for(var i = 0; i < this.players.length; i++){
        var player = this.players[i];
        if(id === player.id) return player;
    }
    return null;
};

Scene.prototype.add = function(player, socket){
    for( var i = 0; i < 255; i ++ ){
        if(this.players.some(function(x){
            return x.id === i;
        })) continue;
        player.id = i;
        player.socket = socket;
        player.enemies = [player];
        this.players.push(player);
        return player;
    }
    return null;
};

Scene.prototype.remove = function(player){
    var ind = this.players.indexOf(player);
    if(ind === -1)  return;
    player.destroy();
    this.players.splice(ind, 1);
};

Scene.prototype.render = function(){

    var self = this,
        number = this.players.length;

    this.players.forEach(function(player, index, players){

        if(!player) return;

        if(Date.now() - player.lastTime > 6000){
            return self.remove(player);
        }

        player.foods = [];

        var X = player.X || 0,
            Y = player.Y || 0;

        // 移动
        if(!(X === 0 && Y === 0)){

            var len = length(X, Y),
                m = 6 - Math.pow(player.size, 0.5) * 0.5;

            player.ox = player.x;
            player.oy = player.y;

            player.x = clamp(X * (m/len) + player.x, 0, self.width);
            player.y = clamp(Y * (m/len) + player.y, 0, self.height);

        }


        // 同屏检测
        for(var j = index+1; j < number; j++){
            
            var next = players[j];

            if(next && Math.abs(next.x - player.x) <= 320 && Math.abs(next.y - player.y) <= 170){
                
                next.enemies.push(player);
                player.enemies.push(next);

                // 包含检测
                var a = player.contains(next),
                    b = next.contains(player);
                if( a || b ){
                    
                    if(b){
                        a = next; b = player;
                    }else{
                        a = player; b = next;
                    }
                    

                    a.s += b.s;
                    a.size = Math.round(Math.pow((a.s / Math.PI), 0.5));

                    var buffer = new Buffer(1);
                    buffer.writeInt8(3);
                    b.socket.send(buffer);

                    self.remove(b);

                }

            }
        }

        // 食物检测
        player.foods = self.foodsQuadTree.pruneInverse(player.x - 320, player.y - 170, 640, 340).map(function(x){

            var food = {x: x.left + 7, y: x.top + 7};

            if(
                (Math.abs(food.x - player.x) <= (player.size - 6) && 
                 Math.abs(food.y - player.y) <= (player.size - 6)) || 
                (Math.abs(food.x - player.ox) <= (player.size - 6) && 
                 Math.abs(food.y - player.oy) <= (player.size - 6))){

                self.foods.splice(j, 1);
                self.addFood(Math.floor(self.width * Math.random()), Math.floor(self.height * Math.random()));
                player.s += 50;
                player.size = Math.round(Math.pow((player.s / Math.PI), 0.5));

            }else{
                self.foodsQuadTree.insert(x);
            }

            return food;
        });


    });

    this.players.forEach(function(player, index, players){

        var num = player.enemies.length,
            len = num * 12 + 3;
        
        var buffer = new Buffer(len + 2 + player.foods.length * 8);
        buffer.writeInt8(2, 0); // 地图
        buffer.writeUInt16BE(num, 1);

        for(var j = 0; j < num; j++){
            var enemy = player.enemies[j];

            buffer.writeUInt16BE(enemy.id, 3 + j * 12); // id
            buffer.writeUInt16BE(enemy.size, 5 + j * 12); // size
            buffer.writeFloatBE(enemy.x, 7 + j * 12); // x
            buffer.writeFloatBE(enemy.y, 11 + j * 12); // y
        }

        num = player.foods.length;
        buffer.writeUInt16BE(num, len);

        for(var j = 0; j < num; j++){
            var food = player.foods[j];

            buffer.writeFloatBE(food.x, len + 2 + j * 8); // id
            buffer.writeFloatBE(food.y, len + 6 + j * 8); // id

        }
        
        player.socket.send(buffer);
        player.enemies = [player];

    });

};

module.exports = Scene;
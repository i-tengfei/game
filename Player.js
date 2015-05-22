function Player(size, x, y){
    this.size = size || 10;
    this.x = x || 0;
    this.y = y || 0;
    this.s = Math.round(this.size * this.size * Math.PI);
}
Player.prototype.destroy = function(){
    this.size = 0;
    this.s = 0;
};
Player.prototype.contains = function(player){
    var dx = this.x - player.x, dy = this.y - player.y;
    return dx * dx + dy * dy <= this.size * this.size - player.size * player.size;
};

module.exports = Player;
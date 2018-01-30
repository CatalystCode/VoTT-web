function PassthroughEncoder(){
}

PassthroughEncoder.prototype.encode = function(input){
  return input;
};

PassthroughEncoder.prototype.decode = function(textToDecode){
  return textToDecode;
};

module.exports = {
    PassthroughEncoder:PassthroughEncoder
};

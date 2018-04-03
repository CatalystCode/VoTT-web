LABEL maintainer="raweil@microsoft.com"
USER root

RUN apt-get update -y --fix-missing
RUN apt-get install -y --fix-missing \
    curl \
    git \
    
RUN curl -sL https://deb.nodesource.com/setup_7.x | sudo -E bash -
RUN apt-get install nodejs

ADD ./ /VoTT-web

WORKDIR /VoTT-web

CMD npm install
CMD node app.js

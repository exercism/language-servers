FROM ruby:2.6.6

WORKDIR /opt/exercism/ruby-language-server/current

RUN gem install solargraph

CMD solargraph socket --host=0.0.0.0

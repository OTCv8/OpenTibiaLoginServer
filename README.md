# Open Tibia Login Server

### Forum: https://otland.net/threads/open-tibia-login-server-brand-new-open-source-login-server.269004  
### Discord: https://discord.gg/t4ntS5p  

## Features (planned)
* Easy installation and configuration
* Very easy to develop and extend
* Works on almost any operating system
* Fast, should be able to handle 1000 operations/s
* Support for classic (tcp, 7.40-11.00) and new (http) tibia login 
* Support for websockets (otclientv8 login)
* Support for status for ots list
* Support for autorization token
* Ingame account and character creation (otclientv8)
* Support for casts & cams
* Support for proxies
* Support for multiple worlds

### If you want some new feature, just open issue with feature request

## Under development

## Quick tutorial

1. Install nodejs: `apt install nodejs` or https://nodejs.org/en/download/
2. Install dependencies, inside project dir run: `npm install`
3. Build project: `npm run build`
4. Configure it, edit `config.json` and your worlds in `worlds` dir
5. If you use custom rsa key, upload your `key.pem`
6. Run it: `npm start`

If you need some help, feel free to ask on forum or discord.

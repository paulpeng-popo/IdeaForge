# IdeaForge

> A tool for online meeting

### prerequisite
- python 3.9 or above
- [ffmpeg](https://ffmpeg.org/download.html#build-windows)

### 線上開會輔助系統
- [X] 開會介面
- [X] 房間系統
- [X] 匿名語音合成
- [X] 開會主持人 -- ChatGPT
- [X] 態度消極警示
- [X] 即時語音通訊

### Installation
```shell
$ git clone https://github.com/paulpeng-popo/IdeaForge.git
$ cd IdeaForge
$ pip install -r requirements.txt
```

### Usage
```shell
$ python app.py
```

### Demo
[see web](http://140.116.245.147:6093)

> 1. 事前設定 -> 進入 `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
> 2. 將 `Insecure origins treated as secure` 設定為 `Enabled`
> 3. 添加 `http://140.116.245.147:6093` 到 `Insecure origins` 中，並重新啟動瀏覽器

### Reference
1. MI2S Lab TTS Technology
2. Vue.js
3. Flask
4. Flask-SocketIO
5. ChatGPT

### Future Work
- [ ] Microsoft Azure Speech Synthesis

### Contact
- [Paul Peng](mailto:kmes1234@gmail.com)

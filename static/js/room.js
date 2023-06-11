const { createApp } = Vue;
createApp({
    data() {
        return {
            // streaming
            microphone: false,
            localStream: null,
            pendingCandidates: {},
            peerConnections: {},
            peerConnection_config: {
                'iceServers': [{
                    'urls': 'stun:stun.l.google.com:19302'
                }]
            },

            // chat variables
            inner_text: "",
            outer_text: "",
            chat_messages: [],
            showMenu: false,

            // chatGPT
            questions: [],
            speaking: false,
            waiting_buffer: [],
            audio_buffer: [],
            tts_processing: false,

            // socket.io
            socket: null,
            socketId: '',
            roomId: '',
            userName: '',

            // attendee
            attendee: 0,
            attendeeList: [],
            attendee_rows: [],

            // idle handler
            isIdle: false,
            timer: null,
            idleThreshold: 300,
            grade_report: {},

            // preloaded data
            qa_data: [],
            offensiveWords: [],
        }
    },
    watch: {
        waiting_buffer: {
            handler: function (val, oldVal) {
                while (this.tts_processing) {
                    // wait for tts to finish
                }
                if (val.length > 0) {
                    // console.log("tts_say: " + val[0]);
                    this.tts_processing = true;
                    this.tts_say(val[0]);
                    this.waiting_buffer.shift();
                    this.tts_processing = false;
                }
            },
            deep: true,
            immediate: true
        },
        audio_buffer: {
            handler: function (val, oldVal) {
                if (val.length > 0) {
                    let audio_player = new Audio();
                    audio_player.autoplay = true;
                    audio_player.muted = false;
                    audio_player.src = "data:audio/wav;base64," + val[0];
                    audio_player.onplaying = () => {
                        this.speaking = true;
                    };
                    audio_player.onended = () => {
                        this.speaking = false;
                        this.audio_buffer.shift();
                    };
                    audio_player.play();
                }
            },
            deep: true,
            immediate: true
        },
    },
    mounted() {
        // get user name and room id from session storage
        this.userName = sessionStorage.getItem('userName');
        this.roomId = sessionStorage.getItem('roomId');

        // if user name or room id is empty, redirect to index page
        if (!this.userName || !this.roomId) {
            window.location.href = '/';
        }

        this.initSocket();
        this.load_data();
        this.resetTimer();
    },
    methods: {
        initSocket() {
            // get url of current page
            let protocol = window.location.protocol;
            let hostname = window.location.hostname;
            let port = window.location.port;
            let url = protocol + '//' + hostname + ':' + port;

            // connect to socket.io server
            this.socket = io(url, {
                transports: ['websocket']
            });

            // listen for socket connection
            this.socket.on('connect', () => {
                this.socketId = this.socket.id;
                this.socket.emit('join', {
                    roomId: this.roomId,
                    userName: this.userName
                });
            });

            // listen for message from server
            this.socket.on('message', (data) => {
                const parsedData = JSON.parse(JSON.stringify(data));
                const message_format = {
                    "text": parsedData.message,
                    "speaker": parsedData.userName,
                }
                this.chat_messages.push(message_format);
                this.say_sentence(parsedData.message);
            });

            // listen for user list update
            this.socket.on('userList', (data) => {
                const parsedData = JSON.parse(JSON.stringify(data));
                this.attendeeList = parsedData.userList;
                this.update_attendee();
            });

            // listen for peer connection
            this.socket.on('peerConnection', (data) => {
                const parsedData = JSON.parse(JSON.stringify(data));
                this.createPeerConnection(parsedData.socketId);
                this.sendOffer(parsedData.socketId);
                this.addPendingCandidates(parsedData.socketId);
            });

            // listen for audio connection
            this.socket.on('audio_connection', (data) => {
                const parsedData = JSON.parse(JSON.stringify(data));
                this.handleSignalingData(parsedData);
            });

            // listen for hangup
            this.socket.on('hangup', (data) => {
                const parsedData = JSON.parse(JSON.stringify(data));
                this.handleHangup(parsedData.socketId);
            });

            // listen for socket disconnection
            this.socket.on('disconnect', () => {
                this.pop_up('伺服器連線中斷，請重新登入', 'info');
                // clear session storage
                sessionStorage.clear();
                // redirect to index page
                window.location.href = '/';
            });
        },
        sendAudioData(data) {
            this.socket.emit('audio_connection', data);
        },
        createPeerConnection(socketId) {
            try {
                const { peerConnection_config } = this;
                const peerConnection = new RTCPeerConnection(peerConnection_config);
                peerConnection.onicecandidate = this.onIceCandidate;
                peerConnection.onaddstream = this.onAddStream;
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => peerConnection.addTrack(track, this.localStream));
                }
                this.peerConnections[socketId] = { peerConnection };
            } catch (err) {
                this.pop_up('建立連線失敗', 'error');
                console.log(err);
            }
        },
        sendOffer(socketId) {
            this.peerConnections[socketId].peerConnection.createOffer({
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 0
            }).then(
                (sdp) => this.setAndSendLocalDescription(socketId, sdp),
                (err) => {
                    this.pop_up('offer 建立失敗', 'error');
                    console.log(err);
                }
            );
        },
        sendAnswer(socketId) {
            this.peerConnections[socketId].peerConnection.createAnswer().then(
                (sdp) => this.setAndSendLocalDescription(socketId, sdp),
                (err) => {
                    this.pop_up('answer 建立失敗', 'error');
                    console.log(err);
                }
            );
        },
        setAndSendLocalDescription(socketId, description) {
            this.peerConnections[socketId].peerConnection.setLocalDescription(description);
            this.sendAudioData({
                'sid': socketId,
                'type': description.type,
                'sdp': description.sdp
            });
        },
        onIceCandidate(event) {
            const { candidate } = event;
            if (candidate) {
                this.sendAudioData({
                    'type': 'candidate',
                    'candidate': candidate,
                });
            }
        },
        onAddStream(event) {
            let audio_player = new Audio();
            audio_player.autoplay = true;
            audio_player.controls = true;
            audio_player.srcObject = event.stream;
            audio_player.play();
        },
        addPendingCandidates(socketId) {
            if (socketId in this.pendingCandidates) {
                const pendingCandidates = this.pendingCandidates[socketId];
                for (const candidate of pendingCandidates) {
                    try {
                        this.peerConnections[socketId].peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        // do nothing
                    }
                }
            }
        },
        handleSignalingData(data) {
            const { sid, ...rest } = data;
            switch (rest.type) {
                case 'offer':
                    if (this.microphone) {
                        this.createPeerConnection(sid);
                        this.peerConnections[sid].peerConnection.setRemoteDescription(new RTCSessionDescription(rest));
                        this.sendAnswer(sid);
                        this.addPendingCandidates(sid);
                    }
                    break;
                case 'answer':
                    this.peerConnections[sid].peerConnection.setRemoteDescription(new RTCSessionDescription(rest));
                    break;
                case 'candidate':
                    if (sid in this.peerConnections) {
                        try {
                            this.peerConnections[sid].peerConnection.addIceCandidate(new RTCIceCandidate(rest.candidate));
                        } catch (err) {
                            // do nothing
                        }
                    } else {
                        this.pendingCandidates[sid] = this.pendingCandidates[sid] || [];
                        this.pendingCandidates[sid].push(signalingData.candidate);
                    }
                    break;
            }
        },
        handleHangup(socketId) {
            try {
                this.peerConnections[socketId].peerConnection.close();
                delete this.peerConnections[socketId];
            } catch (err) {
                // do nothing
            }
        },
        async microphone_toggle() {
            this.microphone = !this.microphone;
            if (this.microphone) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    });
                    this.localStream = stream;
                    this.socket.emit('audio', {
                        socketId: this.socketId
                    });
                } catch (error) {
                    this.handleMicrophoneError(error);
                }
            } else {
                this.stopMicrophone();
            }
        },
        handleMicrophoneError(error) {
            this.pop_up('無法取得麥克風權限', 'error');
            console.log(error);
        },
        stopMicrophone() {
            // stop send local audio stream to peer
            // but still receive remote audio stream from peer
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            this.socket.emit('audio', {
                socketId: this.socketId
            });
        },
        update_attendee() {
            this.attendee = this.attendeeList.length;
            let total_attendee = this.attendee + 1;

            let pic_names = [
                "p1_nobg.png",
                "p2_nobg.png",
                "p3_nobg.png",
                "p4_nobg.png",
                "p5_nobg.png",
                "p6_nobg.png"
            ];

            // 2x3 array
            this.attendee_rows = [];
            let row = [];
            for (let i = 0; i < total_attendee; i++) {
                // i == 0 is the host
                let name = "";
                let avatar = "";
                let col_width = "col-4";
                if (i == 0) {
                    name = "主持人"
                    avatar = "../static/images/robot_nobg.png";
                } else {
                    let random_index = Math.floor(Math.random() * 6);
                    name = this.attendeeList[i - 1].userName;
                    avatar = "../static/images/" + pic_names[random_index];
                }

                row.push({
                    name: name,
                    avatar: avatar,
                    col_width: col_width
                });

                if (row.length == 3) {
                    this.attendee_rows.push(row);
                    row = [];
                }
            }

            if (row.length > 0) {
                // change col width to 6
                for (let i = 0; i < row.length; i++) {
                    row[i].col_width = "col-6";
                }
                this.attendee_rows.push(row);
                row = [];
            }
        },
        resetTimer() {
            this.isIdle = false;

            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                this.isIdle = true;
                // 紀錄使用者被系統判定為消極的時間及次數
                let user_name = this.userName;
                let time_stamp = new Date().toLocaleString();
                if (!(user_name in this.grade_report)) {
                    this.grade_report[user_name] = {
                        "frequency": 0,
                        "time_stamp": []
                    };
                }
                this.grade_report[user_name].frequency += 1;
                this.grade_report[user_name].time_stamp.push(time_stamp);
                text = "您已經" + this.grade_report[user_name].frequency + "次被系統判定為消極，請積極參與討論";
                this.pop_up(text, "warning");
                // console.log(this.grade_report);
                // TODO: send this grade report to server
            }, this.idleThreshold * 1000);
        },
        selectQuestion(event, q_id, question) {
            event.preventDefault();

            // command mode
            if (q_id === "0") {
                this.outer_text = "＠";
            } else {
                // default questions
                this.outer_text = "＠" + question;
            }
            this.showMenu = false;
        },
        repeat(event, message_obj) {
            event.preventDefault();

            let text = message_obj.text;
            text = text.replace(/^＠|^@/, "");
            this.say_sentence(text);
        },
        say_sentence(context) {
            this.waiting_buffer.push(context);
        },
        tts_say(context) {
            $.ajax({
                method: "POST",
                url: "/say",
                data: {
                    "text": context,
                },
                dataType: "json",
            })
                .done(result => {
                    if (result["status"] == "true") {
                        this.audio_buffer.push(result["data"]);
                    } else {
                        this.pop_up(result["data"], "warning");
                        return false;
                    }
                })
                .fail(result => {
                    this.pop_up("合成伺服器錯誤，請稍後再試", "error");
                    console.log("FAILED: " + result);
                    return false;
                });

            return true;
        },
        send_inner(event) {
            event.preventDefault();

            // 取得輸入框內容
            this.inner_text = this.inner_text.trim();
            if (this.inner_text == "") return false;

            // 檢查是否有攻擊性詞彙
            if (this.check_offensive(this.outer_text)) {
                return false;
            }

            // 去除字串裡的 ＠ 或 @
            this.inner_text = this.inner_text.replace(/^＠|^@/, "");

            // 將訊息加入聊天室
            this.chat_messages.push({
                "text": this.inner_text,
                "speaker": "系統代言人"
            });

            this.say_sentence(this.inner_text);

            // 將訊息傳送給其他人
            this.socket.emit("message", {
                "roomId": this.roomId,
                "userName": "系統代言人",
                "message": this.inner_text
            });

            this.inner_text = "";
            this.resetTimer();
        },
        send_outer(event) {
            event.preventDefault();

            // 取得輸入的文字
            this.outer_text = this.outer_text.trim();
            if (this.outer_text == "") return false;

            // 檢查是否有攻擊性詞彙
            if (this.check_offensive(this.outer_text)) {
                return false;
            }

            // 將文字加入聊天室
            this.chat_messages.push({
                "text": this.outer_text,
                "speaker": this.userName
            });

            this.say_sentence(this.outer_text);

            // socket emit to other users
            this.socket.emit('message', {
                "roomId": this.roomId,
                "userName": this.userName,
                "message": this.outer_text
            });

            // 將文字傳送給後端
            if (this.outer_text[0] == "＠" || this.outer_text[0] == "@") {
                let answer = this.get_answer(this.outer_text.slice(1));
                if (answer == "") {
                    answer = "暫不提供客製化提問，請選擇系統內建問題。"
                    this.say_sentence(answer);
                } else {
                    // 將回答加入聊天室
                    this.chat_messages.push({
                        "text": answer,
                        "speaker": "主持人",
                    });
                    this.socket.emit('message', {
                        "roomId": this.roomId,
                        "userName": "主持人",
                        "message": answer,
                    });
                    this.say_sentence(answer);
                }
            }
            this.outer_text = "";
            this.resetTimer();
        },
        member0() {
            let myModal = new bootstrap.Modal(document.getElementById('anonymous'), {
                // keyboard: false --> means if you press "Esc" the modal won't close
                keyboard: false
            });
            myModal.show()
        },
        pop_up(message, icon) {
            Swal.fire({
                width: 600,
                padding: '2em',
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false,
                title: message,
                confirmButtonText: '知道了',
                confirmButtonColor: '#3085d6',
                icon: icon,
            });
        },
        check_offensive(input_text) {
            for (i = 0; i < this.offensiveWords.length; i++) {
                if (input_text.includes(this.offensiveWords[i])) {
                    this.pop_up("請勿輸入攻擊性詞彙", "warning");
                    return true;
                }
            }
            return false;
        },
        get_answer(user_q) {
            let answer = "";
            for (let i = 0; i < this.qa_data.length; i++) {
                if (this.qa_data[i].Question == user_q) {
                    answer = this.qa_data[i].Answer;
                    break;
                }
            }
            return answer
        },
        load_data() {
            this.offensiveWords = [
                "馬的", "他馬的", "他媽的", "媽的", "三小",
                "你媽死了", "王八蛋", "白痴", "白ㄔ", "白癡",
                "白吃", "笨蛋", "神經病", "智障", "吃屎"
            ];
            this.qa_data = [
                {
                    "id": "0",
                    "Question": "點選並輸入想詢問 ChatGPT 的問題",
                    "Answer": ""
                },
                {
                    "id": "1",
                    "Question": "開會流程有什麼？",
                    "Answer": "開場、議程確認、報告與討論、行動項目確認、總結、結束。"
                },
                {
                    "id": "2",
                    "Question": "如何規劃專案執行的進度？",
                    "Answer": "目標設定、任務分配、時間估計、排程安排、監控進度。"
                },
                {
                    "id": "3",
                    "Question": "如何避免分工不均？",
                    "Answer": "明確職責、溝通協調、平衡工作量、確保資源、持續評估。"
                },
                {
                    "id": "4",
                    "Question": "如何破冰？",
                    "Answer": "互相介紹、小遊戲、共享興趣、開放式問題、輕鬆交流。"
                },
                {
                    "id": "5",
                    "Question": "有哪些適合小組共同編輯筆記的軟體？",
                    "Answer": "Google Docs、Microsoft Teams、Notion、Slack、Trello。"
                },
                {
                    "id": "6",
                    "Question": "有哪些適合作為小組專案管理的軟體？",
                    "Answer": "Asana、Trello、Jira、Basecamp、Microsoft Planner。"
                },
                {
                    "id": "7",
                    "Question": "該怎麼避免會議離題？",
                    "Answer": "明確議程，控制討論時間，引導回正題，鼓勵具體討論，總結行動項目。"
                },
                {
                    "id": "8",
                    "Question": "工作如何分配？",
                    "Answer": "了解能力，設定職責，溝通清晰，協作機會均等，彈性調整。"
                },
                {
                    "id": "9",
                    "Question": "今天會議需要討論的題目有: 1.期末專題主題 2.分工 3.時程規劃，幫我安排會議大綱和時長？",
                    "Answer": "期末專題主題討論（10分鐘），分工安排與職責討論（15分鐘），時程規劃和里程碑設定（10分鐘），總結和下一步行動確認（5分鐘）。"
                },
                {
                    "id": "10",
                    "Question": "我們小組內部吵架了，請問該怎麼辦？",
                    "Answer": "冷靜下來，彼此尊重，共同關注目標，找出共識點，以建設性方式解決分歧，繼續合作。"
                }
            ];
            for (let i = 0; i < this.qa_data.length; i++) {
                this.questions.push({
                    id: this.qa_data[i].id,
                    text: this.qa_data[i].Question
                });
            }
        }
    },
    delimiters: ['[[', ']]']
}).mount('#app');

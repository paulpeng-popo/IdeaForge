const { createApp } = Vue;
createApp({
    data() {
        return {
            // streaming
            microphone: false,

            // chat variables
            inner_text: "",
            outer_text: "",
            chat_messages: [],
            showMenu: false,

            // chatGPT
            full_qa_data: [],
            questions: [],
            selectedQuestion: "",
            speaking: false,

            // record voice
            // mediaRecorder: null,
            // isRecording: false,
            // chunks: [],

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
            idleThreshold: 20,

            //offensive words
            offensive: ["幹", "馬的", "他馬的", "他媽的", "媽的", "三小", "你媽死了", "王八蛋", "白痴", "笨蛋", "神經病", "智障", "吃屎"],
        }
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
        this.load_qa();
        for (let i = 0; i < this.full_qa_data.length; i++) {
            this.questions.push({
                id: this.full_qa_data[i].id,
                text: this.full_qa_data[i].Question
            });
        }

        // detect idle
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
                // convert object to JSON string
                data = JSON.stringify(data);
                // convert JSON string to JSON object
                data = JSON.parse(data);
                message_format = {
                    "text": data.message,
                    "speaker": data.userName,
                    "filename": data.filename,
                }
                this.chat_messages.push(message_format);
                if (data.userName == "主持人") {
                    this.say_sentence(data.filename, "/get_default");
                } else {
                    this.say_sentence(data.message, "/say");
                }
            });

            // listen for user list update
            this.socket.on('userList', (data) => {
                // convert object to JSON string
                data = JSON.stringify(data);
                // convert JSON string to JSON object
                data = JSON.parse(data);
                this.attendeeList = data.userList;
                this.update_attendee();
            });

            // listen for socket disconnection
            this.socket.on('disconnect', () => {
                alert('連線已中斷，請重新登入');
                // clear session storage
                sessionStorage.clear();
                // redirect to index page
                window.location.href = '/';
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
                    name = this.attendeeList[i - 1];
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
                // alert('請積極參與討論');
            }, this.idleThreshold * 1000);
        },
        // upload(blob) {
        //     var xhr = new XMLHttpRequest();
        //     xhr.open('POST', '/recog');
        //     xhr.onload = function () {
        //         if (xhr.status === 200) {
        //             // parse JSON response
        //             var response = JSON.parse(xhr.responseText);
        //             console.log(response);
        //             outer_text = response.text;
        //         } else {
        //             alert('錯誤！請重新錄音');
        //         }
        //     };
        //     xhr.send(blob);
        // },
        // record_voice() {
        //     if (this.isRecording) {
        //         this.mediaRecorder.stop();
        //         this.isRecording = false;
        //     } else {
        //         navigator.mediaDevices.getUserMedia({
        //             audio: true, video: false
        //         }).then(stream => {
        //             this.mediaRecorder = new MediaRecorder(stream);
        //             this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
        //             this.mediaRecorder.onstop = e => {
        //                 let blob = new Blob(this.chunks, {
        //                     type: 'audio/wav; codecs=MS_PCM'
        //                 });
        //                 this.chunks = [];
        //                 this.upload(blob);
        //             };
        //             this.mediaRecorder.start();
        //             this.isRecording = true;
        //         }).catch(console.error);
        //     }
        // },
        microphone_toggle(event) {
            event.preventDefault();
            this.microphone = !this.microphone;
            console.log("麥克風狀態: " + this.microphone);
            let icon = document.getElementById("microphone_icon");
            if (this.microphone) {
                icon.classList.remove("fa-microphone-slash");
                icon.classList.add("fa-microphone");
            } else {
                icon.classList.remove("fa-microphone");
                icon.classList.add("fa-microphone-slash");
            }
            // this.record_voice();
        },
        selectQuestion(event, question_id) {
            event.preventDefault();
            for (let i = 0; i < this.questions.length; i++) {
                if (this.questions[i].id === question_id) {
                    this.selectedQuestion = this.questions[i].text;
                    break;
                }
            }
            this.outer_text = "＠" + this.selectedQuestion
            this.showMenu = false;
        },
        repeat(event, message_obj) {
            event.preventDefault();
            if ("filename" in message_obj && message_obj.filename != undefined) {
                this.say_sentence(message_obj.filename, "/get_default");
            } else {
                let text = message_obj.text;
                if (text.startsWith("＠") || text.startsWith("@")) {
                    text = text.substring(1);
                }
                this.say_sentence(text, "/say");
            }
        },
        say_sentence(context, api_path) {
            $.ajax({
                method: "POST",
                url: api_path,
                data: {
                    "text": context,
                    "filename": context
                },
                dataType: "json",
            })
                .done(result => {
                    if (result["status"] == "true") {
                        let audio_player = document.getElementById("audio");
                        audio_player.src = "data:audio/wav;base64," + result["data"];
                        audio_player.onplaying = () => {
                            this.speaking = true;
                        };
                        audio_player.onended = () => {
                            this.speaking = false;
                        };
                        audio_player.play();
                    } else {
                        console.log("FAILED: " + result);
                        return false;
                    }
                })
                .fail(function (result) {
                    console.log("FAILED: " + result);
                    return false;
                });
        },
        send_inner(event) {
            event.preventDefault();
            this.inner_text = this.inner_text.trim();
            if (this.inner_text == "") return false;
            if (this.inner_text[0] == "＠" || this.inner_text[0] == "@") {
                this.inner_text = this.inner_text.substring(1);
            }
            this.chat_messages.push({
                "text": this.inner_text,
                "speaker": "系統代言人"
            });
            // this.say_sentence(this.inner_text, "/say");
            this.socket.emit("message", {
                "roomId": this.roomId,
                "userName": "系統代言人",
                "message": this.inner_text
            });
            for (i = 0; i < this.offensive.length; i++) {
                if (this.inner_text.includes(this.offensive[i])) {
                    this.chat_messages.pop()
                    this.chat_messages.push({
                        "text": "請勿輸入攻擊性詞彙",
                        "speaker": "系統代言人"
                    });
                }
                break;
            }
            this.inner_text = "";
            this.resetTimer();
        },
        send_outer(event) {
            event.preventDefault();
            this.outer_text = this.outer_text.trim();
            if (this.outer_text == "") return false;
            this.chat_messages.push({
                "text": this.outer_text,
                "speaker": this.userName
            });
            if (this.outer_text[0] == "＠" || this.outer_text[0] == "@") {
                this.socket.emit('message', {
                    "roomId": this.roomId,
                    "userName": this.userName,
                    "message": this.outer_text
                });
                let answer = this.get_answer(this.outer_text.slice(1));
                if (answer.text == "") {
                    answer.text = "暫不提供客製化提問，請選擇系統內建問題。"
                    this.say_sentence(answer.text, "/say");
                } else {
                    this.chat_messages.push({
                        "text": answer.text,
                        "speaker": "主持人",
                        "filename": answer.filename
                    });
                    this.say_sentence(answer.filename, "/get_default");
                    this.socket.emit('message', {
                        "roomId": this.roomId,
                        "userName": "主持人",
                        "message": answer.text,
                        "filename": answer.filename
                    });
                }
            } else {
                this.socket.emit('message', {
                    "roomId": this.roomId,
                    "userName": this.userName,
                    "message": this.outer_text
                });
            }

            for (i = 0; i < this.offensive.length; i++) {
                if (this.outer_text.includes(this.offensive[i])) {
                    this.chat_messages.pop()
                    this.chat_messages.push({
                        "text": "請勿輸入攻擊性詞彙",
                        "speaker": this.userName
                    });
                    break;
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
        get_answer(user_q) {
            let answer = {
                "filename": "",
                "text": ""
            };
            for (let i = 0; i < this.full_qa_data.length; i++) {
                if (this.full_qa_data[i].Question == user_q) {
                    answer.filename = "answer" + this.full_qa_data[i].id + ".mp3";
                    answer.text = this.full_qa_data[i].Answer;
                    break;
                }
            }
            return answer
        },
        load_qa() {
            this.full_qa_data = [
                {
                    "id": "1",
                    "Question": "開會流程有什麼？",
                    "Answer": "開場、議程確認、報告與討論、行動項目確認、總結、結束。"
                },
                {
                    "id": "2",
                    "Question": "如何規劃專案執行的進度",
                    "Answer": "目標設定、任務分配、時間估計、排程安排、監控進度。"
                },
                {
                    "id": "3",
                    "Question": "如何避免分工不均",
                    "Answer": "明確職責、溝通協調、平衡工作量、確保資源、持續評估。"
                },
                {
                    "id": "4",
                    "Question": "如何破冰",
                    "Answer": "互相介紹、小遊戲、共享興趣、開放式問題、輕鬆交流。"
                },
                {
                    "id": "5",
                    "Question": "有哪些適合小組共同編輯筆記的軟體",
                    "Answer": "Google Docs、Microsoft Teams、Notion、Slack、Trello。"
                },
                {
                    "id": "6",
                    "Question": "有哪些適合作為小組專案管理的軟體",
                    "Answer": "Asana、Trello、Jira、Basecamp、Microsoft Planner。"
                },
                {
                    "id": "7",
                    "Question": "該怎麼避免會議離題",
                    "Answer": "明確議程，控制討論時間，引導回正題，鼓勵具體討論，總結行動項目。"
                },
                {
                    "id": "8",
                    "Question": "如何分工",
                    "Answer": "了解能力，設定職責，溝通清晰，協作機會均等，彈性調整。"
                },
                {
                    "id": "9",
                    "Question": "今天會議需要討論的題目有: 1.期末專題主題 2. 分工 3. 時程規劃，請幫我安排會議大綱和時長",
                    "Answer": "期末專題主題討論（10分鐘），分工安排與職責討論（15分鐘），時程規劃和里程碑設定（10分鐘），總結和下一步行動確認（5分鐘）"
                },
                {
                    "id": "10",
                    "Question": "我們小組內部吵架了，作為主持人請幫忙打圓場",
                    "Answer": "冷靜下來，彼此尊重，共同關注目標，找出共識點，以建設性方式解決分歧，繼續合作。"
                }
            ];
        }
    },
    delimiters: ['[[', ']]']
}).mount('#app');

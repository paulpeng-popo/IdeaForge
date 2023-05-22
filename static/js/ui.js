const vm = Vue.createApp({
    el: '#app',
    data() {
        return {
            microphone: false,
            questions: [
                { id: 1, text: "常用1" },
                { id: 2, text: "常用2" },
                { id: 3, text: "常用3" },
                { id: 4, text: "常用4" },
                { id: 5, text: "常用5" },
                { id: 6, text: "常用6" },
                { id: 7, text: "常用7" },
                { id: 8, text: "常用8" },
                { id: 9, text: "常用9" },
                { id: 10, text: "常用10" },
            ],
            selectedQuestion: "",
            showMenu: false,
            on_mode: false,
            theMode: "一般討論模式",
            mediaRecorder: null,
            chunks: [],
            isRecording: false,
        }
    },
    methods: {
        upload(blob) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', '/recog');
            xhr.onload = function () {
                if (xhr.status === 200) {
                    // parse JSON response
                    var response = JSON.parse(xhr.responseText);
                    console.log(response);
                    document.getElementById("speech_text").value = response.text;
                } else {
                    alert('錯誤！請重新錄音');
                }
            };
            xhr.send(blob);
        },
        record_voice() {
            if (this.isRecording) {
                this.mediaRecorder.stop();
                this.isRecording = false;
            } else {
                navigator.mediaDevices.getUserMedia({
                    audio: true, video: false
                }).then(stream => {
                    this.mediaRecorder = new MediaRecorder(stream);
                    this.mediaRecorder.ondataavailable = e => this.chunks.push(e.data);
                    this.mediaRecorder.onstop = e => {
                        let blob = new Blob(this.chunks, {
                            type: 'audio/wav; codecs=MS_PCM'
                        });
                        this.chunks = [];
                        this.upload(blob);
                    };
                    this.mediaRecorder.start();
                    this.isRecording = true;
                }).catch(console.error);
            }
        },
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
            this.record_voice();
        },
        switch_toggle() {
            this.on_mode = !this.on_mode;
            console.log("匿名發言模式: " + this.on_mode);
            if (this.on_mode) {
                this.theMode = "匿名發言模式";
            } else {
                this.theMode = "一般討論模式";
            }
        },
        selectQuestion(event, question_id) {
            event.preventDefault();
            for (let i = 0; i < this.questions.length; i++) {
                if (this.questions[i].id === question_id) {
                    this.selectedQuestion = this.questions[i].text;
                    break;
                }
            }
            console.log("選擇的問題: " + this.selectedQuestion);
            this.showMenu = false;
        },
        repeat(event) {
            event.preventDefault();
            let audio_player = document.getElementById("audio");
            audio_player.play();
        },
        send_input(event) {
            event.preventDefault();
            input_text = document.getElementById("speech_text").value;
            document.getElementById("speech_text").value = ""
            input_text = input_text.trim();
            if (input_text == "") return false;
            console.log(input_text);
            $.ajax({
                method: "POST",
                url: "/say",
                data: {
                    "text": input_text
                },
                dataType: "json",
            })
                .done(function (result) {
                    if (result["status"] == "true") {
                        let audio_player = document.getElementById("audio");
                        audio_player.src = "data:audio/wav;base64," + result["data"];
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
        member0() {
            console.log('member-0 click')
            var myModal = new bootstrap.Modal(document.getElementById('member0Modal'), {
                keyboard: false
            })
            myModal.show()
        },
    },
    delimiters: ['[[', ']]']
});
vm.mount('#app');

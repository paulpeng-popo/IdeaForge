const { createApp } = Vue;
createApp({
    data() {
        return {
            // show start animation
            showElement: false,

            // room data
            isCreateRoom: false,
            isJoinRoom: false,
            roomId: '',
            userName: '',
        }
    },
    mounted() {
        this.showElement = true;
    },
    methods: {
        showCreateRoom() {
            console.log('create room');
            this.isJoinRoom = false;
            this.isCreateRoom = true;
            // generate random room id consisting of 6 digits
            this.roomId = Math.floor(100000 + Math.random() * 900000);
        },
        showJoinRoom() {
            console.log('join room');
            this.isCreateRoom = false;
            this.isJoinRoom = true;
        },
        createRoom(event) {
            event.preventDefault();

            console.log(this.userName);
            console.log(this.roomId);

            // check room id
            axios.get(`/api/room/${this.roomId}`)
                .then(res => {
                    if (res.data.status == 'false') {
                        alert('房號已存在，請重新刷新頁面以獲取新的房號');
                    } else {
                        // save user name and room id to session storage
                        sessionStorage.setItem('userName', this.userName);
                        sessionStorage.setItem('roomId', this.roomId);
                        // redirect to room page
                        this.redirectToRoom();
                    }
                })
                .catch(err => {
                    console.log(err);
                });
        },
        redirectToRoom() {
            setTimeout(() => {
                // redirect to room page
                window.location.href = `/room/${this.roomId}`;
            }, 1000);
        },
        joinRoom(event) {
            event.preventDefault();

            if (!this.checkRoomId()) {
                return;
            }

            console.log(this.userName);
            console.log(this.roomId);

            // check room id
            axios.get(`/api/room/${this.roomId}`)
                .then(res => {
                    if (res.data.status == 'false') {
                        // save user name and room id to session storage
                        sessionStorage.setItem('userName', this.userName);
                        sessionStorage.setItem('roomId', this.roomId);
                        // redirect to room page
                        this.redirectToRoom();
                    } else {
                        alert('房號不存在，請重新輸入');
                    }
                });
        },
        checkRoomId() {
            // convert roomId to string
            this.roomId = this.roomId.toString();
            // ensure room id is 6 digits
            if (this.roomId.length != 6) {
                // set custom validation message
                $('#roomName').get(0).setCustomValidity('房號為 6 位數字');
                $('#roomName').get(0).reportValidity();
                return false;
            } else {
                $('#roomName').get(0).setCustomValidity('');
                return true;
            }
        }
    },
    delimiters: ['[[', ']]']
}).mount('#app');

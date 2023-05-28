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

            const formData = new FormData();
            formData.append('type', 'create');
            formData.append('userName', this.userName);
            formData.append('roomId', this.roomId);

            this.infoCheck(formData);
        },
        joinRoom(event) {
            event.preventDefault();

            if (!this.checkRoomId()) {
                return;
            }

            const formData = new FormData();
            formData.append('type', 'join');
            formData.append('userName', this.userName);
            formData.append('roomId', this.roomId);

            this.infoCheck(formData);
        },
        infoCheck(data) {
            axios.post('/check', data)
                .then(res => {
                    if (res.data.status == 'false') {
                        alert(res.data.message);
                    } else {
                        // save user name and room id to session storage
                        // and set session storage to expire after 1 hour
                        sessionStorage.setItem('userName', this.userName);
                        sessionStorage.setItem('roomId', this.roomId);
                        sessionStorage.setItem('expire', Date.now() + 3600000);

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
            }, 500);
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
            }

            // convert userName to string
            this.userName = this.userName.toString();
            // ensure user name is not empty
            if (this.userName == '') {
                // set custom validation message
                $('#userName').get(0).setCustomValidity('請輸入暱稱');
                $('#userName').get(0).reportValidity();
                return false;
            } else {
                $('#userName').get(0).setCustomValidity('');
            }

            return true;
        }
    },
    delimiters: ['[[', ']]']
}).mount('#app');

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

            full_qa_data: [],
            questions: [],
            selectedQuestion: "",

            // record voice
            mediaRecorder: null,
            isRecording: false,
            chunks: [],

            // socket.io
            socket: null,
            socketId: '',
            roomId: '',
            userName: '',
        }
    },
    mounted() {
        // get user name and room id from session storage
        this.userName = sessionStorage.getItem('userName');
        this.roomId = sessionStorage.getItem('roomId');
        console.log('user name: ' + this.userName);
        console.log('room id: ' + this.roomId);

        // check if user name and room id are set
        this.initSocket();
        this.load_qa();
        for (let i = 0; i < this.full_qa_data.length; i++) {
            this.questions.push({
                id: this.full_qa_data[i].id,
                text: this.full_qa_data[i].Question
            });
        }
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
                console.log('new socket connection');
                this.socketId = this.socket.id;
                console.log('socket id: ' + this.socketId);
                this.socket.emit('join', {
                    roomId: this.roomId,
                    userName: this.userName
                });

                // get user list
                this.socket.emit('get_users', {
                    roomId: this.roomId,
                }, (data) => {
                    console.log('user list received');
                    console.log(data);
                    this.userList = data;
                });
            });

            // listen for socket disconnection
            this.socket.on('disconnect', {
                roomId: this.roomId,
                userName: this.userName
            }, (data) => {
                console.log('user disconnected');
                console.log(data);
                this.userList = data;
            });

            // listen for chat message
            this.socket.on('chat', (data) => {
                console.log('chat message received');
                console.log(data);
                this.chat_messages.push(data);
            });

            // listen for voice message
            this.socket.on('voice', (data) => {
                console.log('voice message received');
                console.log(data);
                this.outer_text = data.text;
            });
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
            this.outer_text = "@" + this.selectedQuestion
            console.log("選擇的問題: " + this.selectedQuestion);
            this.showMenu = false;
        },
        // repeat(event) {
        //     event.preventDefault();
        //     let audio_player = document.getElementById("audio");
        //     audio_player.play();
        // },
        say_sentence(sentence) {
            $.ajax({
                method: "POST",
                url: "/say",
                data: {
                    "text": sentence
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
        send_inner(event) {
            event.preventDefault();
            this.inner_text = this.inner_text.trim();
            if (this.inner_text == "") return false;
            console.log(this.inner_text);
            this.chat_messages.push(this.inner_text)
            this.say_sentence(this.inner_text);
            this.inner_text = "";
        },
        send_outer(event) {
            event.preventDefault();
            this.outer_text = this.outer_text.trim();
            if (this.outer_text == "") return false;
            console.log(this.outer_text);
            this.chat_messages.push(this.outer_text)
            if (this.outer_text[0] == "@") {
                console.log("chatGPT mode")
                let answer = this.get_answer(this.outer_text.slice(1));
                if (answer == "") {
                    console.log("找不到答案");
                    answer = "找不到答案";
                } else {
                    this.chat_messages.push(answer)
                    console.log("答案: " + answer);
                    this.say_sentence(answer);
                }
            }
            else {
                console.log("chatRoom mode")
            }
            this.outer_text = "";
        },
        member0() {
            let myModal = new bootstrap.Modal(document.getElementById('anonymous'), {
                // keyboard: false --> means if you press "Esc" the modal won't close
                keyboard: false
            });
            myModal.show()
        },
        get_answer(user_q) {
            let answer = "";
            for (let i = 0; i < this.full_qa_data.length; i++) {
                if (this.full_qa_data[i].Question == user_q) {
                    answer = this.full_qa_data[i].Answer;
                    break;
                }
            }
            return answer;
        },
        load_qa() {
            this.full_qa_data = [
                {
                    "id": "1",
                    "Question": "開會流程有什麼？",
                    "Answer": "開會流程可以根據會議的目的和性質而有所不同，以下是一個常見的開會流程示例：開場：會議主持人宣布會議開始，歡迎與會者，介紹議程和目標。議程確認：主持人分享會議議程，確認與會者是否有任何議程變動或添加事項。公告事項：主持人分享重要公告、通知或團隊相關消息。前次會議記錄審核：回顧上次會議的記錄和行動項目，確保已完成或處理相應問題。报告和更新：各部門或成員分享進展報告、重要資訊或專案更新，並回答其他成員的相關問題。討論和決策：就特定議題進行討論，聆聽各成員的意見和建議，最終達成共識或做出決策。行動項目確認：確定與會者之間的具體行動項目，明確指定負責人和完成日期。開放問答：提供與會者提問和討論的機會，解答疑惑或共享觀點。會議總結：主持人彙總會議內容，確認下次會議時間、地點和議程。會議結束：主持人宣布會議結束，感謝與會者的參與和貢獻。請注意，這只是一個一般的開會流程示例，根據會議的特點和目的，您可以自由調整和定制流程，以符合您的實際需求。"
                },
                {
                    "id": "2",
                    "Question": "如何規劃專案執行的進度",
                    "Answer": "規劃專案執行的進度是確保專案按時完成的重要一環。以下是一些步驟，可協助您有效地規劃專案的執行進度：確定專案目標：明確了解專案的目標和交付物，並將其細分為可量化和可衡量的里程碑。任務識別：識別專案所需的所有任務，確定它們的前後關係和相依性。建立工作分解結構（WBS）：以階層結構的方式，將專案的工作分解為可管理的任務和子任務。估算工作量和時間：針對每個任務估算所需的工作量，並根據資源可用性、過去類似專案的經驗和專家意見來估算完成每個任務所需的時間。建立專案進度表：使用甘特圖、里程碑表或其他適合的工具，將任務和里程碑以時間軸的方式展示出來，以便視覺化整個專案的時間表。資源分配：確定所需的資源（如人力、技術、預算等）並分配給各個任務，考慮到資源的可用性和限制。關鍵路徑分析：確定專案中最長的任務序列，稱為關鍵路徑，並確保專案的其他任務不會延誤關鍵路徑。確定里程碑和關鍵任務：識別關鍵的里程碑和任務，這些是專案成功的重要里程碑和關鍵里程碑，著重於它們的完成時間。建立進度監控機制：設定一個機制來監控和追蹤專案的進度，如定期的進度審查會議，使用專案管理軟體或工具來更新和追蹤進度。調整和管理：專案執行過程中，可能會發生變更和延誤，要及時調整並重新評估進度計劃，進行風險管理和變更控制。"
                },
                {
                    "id": "3",
                    "Question": "如何避免分工不均",
                    "Answer": "避免分工不均是確保團隊成員平等貢獻並實現順利專案執行的重要因素。以下是一些方法可以幫助您避免分工不均：明確角色和責任：在專案開始之前，確定每個團隊成員的角色和責任，明確界定他們的工作範圍和貢獻。這有助於消除不確定性和混淆，確保每個人都清楚自己的責任。平等分配任務：在專案啟動時，盡量平等分配任務，考慮到團隊成員的能力、專業知識和興趣。避免讓某個團隊成員承擔過多的工作負擔，而其他成員相對較少。資源平衡：確保每個團隊成員都有足夠的資源和工具來完成他們的任務。這包括時間、技能培訓、支援和必要的設備或軟體等。盡量避免資源不平衡導致分工不均。開放溝通和協作：建立一個開放和支持溝通的團隊環境，鼓勵成員之間的協作和相互幫助。確保團隊成員可以自由地討論和分享工作上的問題、挑戰和解決方案，從而促進平等分工和共同學習。監控和調整：定期監控團隊成員的工作進展，及早發現分工不均的情況。如果發現某些成員負擔過重或其他成員相對閒置，可以進行調整，重新分配任務或提供額外的支援來平衡分工。激勵和認可：確保公平的激勵和認可機制存在，鼓勵團隊成員積極參與並全力以赴完成任務。給予成員適當的讚賞和獎勵，鼓勵他們的貢獻，從而增強團隊合作和均衡分工的動力。"
                },
                {
                    "id": "4",
                    "Question": "如何破冰",
                    "Answer": "破冰是在團隊或群體中建立融洽關係和增進互相了解的過程。以下是一些方法可以幫助您破冰：遊戲和冰塊破壞器：使用輕鬆有趣的遊戲或冰塊破壞器活動，讓團隊成員參與互動。這些活動可以是小組遊戲、問題解決活動、角色扮演或有趣的挑戰，有助於打破僵局，促進交流和互動。分享個人介紹：給每個團隊成員一些時間，讓他們簡單介紹自己，包括興趣、專業背景或有趣的事情。這有助於彼此更好地了解和建立共鳴，找到共同點。小組合作項目：安排小組合作項目，讓團隊成員一起合作解決問題或完成任務。這種合作可以促進團隊成員之間的互動和交流，並培養彼此之間的信任和合作精神。開放討論和分享：創建一個開放和安全的環境，鼓勵團隊成員分享觀點、經驗和想法。提供一個平台，讓每個人都有機會發言和被聆聽，從而增進相互了解和尊重。社交活動：安排一些社交活動，如午餐聚餐、團隊建設活動或戶外遊樂等。這樣的活動可以營造放鬆和輕鬆的氛圍，讓團隊成員在非工作環境中建立更親密的關係。鼓勵跨部門合作：促進不同部門或團隊之間的合作和交流，可以破除部門間的隔閡，提高整個團隊的凝聚力。例如，安排定期的跨部門會議或專案合作，讓團隊成員跨越組織界限合作。主動倾聽和尊重：在團隊中展示主動倾聽和尊重的態度，給予他人充分的注意和重視。這種尊重有助於建立良好的溝通和關係，讓團隊成員感受到被重視和尊重。"
                },
                {
                    "id": "5",
                    "Question": "有哪些適合小組共同編輯筆記的軟體",
                    "Answer": "以下是一些適合小組共同編輯筆記的軟體和工具：Google Docs：Google Docs 是一個免費的在線文檔處理工具，可實現實時共同編輯功能。多個用戶可以同時編輯同一份文件，並且能夠查看彼此的更改，提供實時協作和註釋功能。Microsoft OneNote：Microsoft OneNote 是一個多功能的筆記和協作工具，可讓團隊成員共同編輯筆記本。它提供了實時同步和註釋功能，可以在不同設備上進行訪問和編輯。Evernote：Evernote 是一個功能豐富的筆記工具，可供團隊成員協作編輯筆記。它支援實時同步和共享筆記本，並且提供了標籤、註釋和註解等功能。Notion：Notion 是一個全能的知識管理和協作工具，可用於共同編輯筆記、文件和專案。它提供了簡潔直觀的界面，支援多種內容格式和嵌入式內容，並具有強大的組織和協作功能。Quip：Quip 是一個集成了文檔、任務列表和即時聊天的協作平台，非常適合小組共同編輯筆記。團隊成員可以同時編輯文檔，討論內容並跟踪任務的進展。這些軟體和工具都提供了實時共同編輯功能，並且可以在不同設備上進行訪問和協作。您可以根據團隊的需求和偏好來選擇適合的工具。"
                },
                {
                    "id": "6",
                    "Question": "有哪些適合作為小組專案管理的軟體",
                    "Answer": "以下是一些適合作為小組專案管理的軟體和工具：Trello：Trello 是一個簡單易用的專案管理工具，使用看板和卡片的方式來組織任務和工作流程。您可以在不同的列中創建卡片，並分配給團隊成員，輕鬆追蹤任務的進度。Asana：Asana 是一個功能強大的專案管理平台，提供了任務追蹤、日曆規劃、文件共享和團隊協作等功能。它使團隊能夠組織、分配和追蹤任務，並提供實時更新和通知。Jira：Jira 是一個廣泛用於敏捷軟體開發的專案管理工具，也適用於其他類型的專案管理。它提供了故事點、問題追蹤、版本控制等功能，以及各種報表和圖表來監控專案進度。Monday.com：Monday.com 是一個直觀的專案管理和團隊協作平台，提供了可自定義的工作看板和追蹤功能。它支援日曆、時間軸、自動提醒等功能，方便團隊協同工作和追蹤任務。Basecamp：Basecamp 是一個集成了專案管理、任務追蹤和團隊協作的平台。它提供了消息板、任務清單、文件共享等功能，並支援實時聊天和進度更新。Microsoft Teams：Microsoft Teams 是一個全面的協作平台，除了聊天和視訊會議功能外，它也提供了專案管理工具，如任務分配、文件共享和共同編輯等功能，能夠融合在日常團隊通訊中。這些軟體和工具都具有專案管理的核心功能，可以幫助團隊組織任務、追蹤進度、分配工作和促進協作。您可以根據團隊的需求和工作流程選擇最適合的工具。"
                },
                {
                    "id": "7",
                    "Question": "該怎麼避免會議離題",
                    "Answer": "避免會議離題是確保會議高效和有效的重要因素。以下是一些方法可以幫助您避免會議離題：事前準備：確保在會議之前有明確的議程和目標。列出要討論的議題，並將其分配給相關的與會者。這有助於確定會議的範圍和重點，減少可能的離題。明確的會議規則：在會議開始之前，向與會者明確說明會議的目的和規則。這可以包括請求與會者遵守議程、尊重彼此的發言權、避免個人攻擊或無關的討論等。管理討論：作為主持人，您可以主動管理討論，確保圍繞著議題進行討論。如果討論偏離了主題，可以及時引導回到正確的方向，或者提醒與會者將相關的討論留到其他時間。使用時間管理技巧：在設定議程時，給予每個議題或討論時間限制。這可以提醒與會者專注於重點，並確保討論不會拖延或浪費時間。鼓勵主題相關的參與：激發與會者對主題的興趣和參與度，可以減少離題的可能性。鼓勵他們分享自己的見解、提出相關的問題，並與其他與會者進行建設性的交流。紀錄討論內容：請一位與會者擔任會議記錄員，負責記錄會議的討論內容和決策結果。這樣可以讓與會者意識到他們的討論是有跡可循的，也可以提醒大家保持專注。定期回顧和評估：在會議結束後，定期回顧會議的進行方式，評估是否有離題的情況發生。根據回顧的結果，調整會議策略和流程，以更好地控制會議的方向。這些方法可以幫助您維持會議的焦點和效率，確保討論在主題內進行。作為主持人，您的積極參與和有效管理是確保會議不離題的關鍵。"
                },
                {
                    "id": "8",
                    "Question": "如何分工",
                    "Answer": "在進行分工時，可以按照以下步驟進行：明確目標：確定項目或任務的具體目標和期望結果。清楚了解要完成的任務的範圍和目的，這樣才能更好地進行分工。評估能力和專長：評估團隊成員的能力和專長，了解每個成員的強項和興趣。這有助於確定每個人在項目中的最佳角色和職責。列出任務清單：將項目或任務細分為可管理的任務清單。確定每個任務所需的工作項目和時間軸。分配任務：根據成員的能力和專長，將任務分配給適合的團隊成員。確保分配合理，並平衡工作量。設定期限：確定每個任務的期限，並與團隊成員進行溝通。確保每個成員清楚明白自己的任務和完成期限。提供支援和資源：確保團隊成員有所需的資源和支援來完成他們的任務。提供必要的培訓、工具和信息，以確保順利執行任務。監控和協調：保持跟踪任務的進展情況，並協調團隊成員之間的合作。確保項目按計劃進行，並在需要時進行調整。溝通和協作：鼓勵團隊成員之間的良好溝通和協作。確保信息流暢，並定期舉行會議或進行更新，以確保所有成員都了解整個項目的狀態和進展。評估和調整：定期評估任務的完成情況，並根據需要進行調整。確保任務按時完成，並根據項目的變化做出必要的調整。分工需要考慮團隊成員的能力、任務的性質和期限，以確保每個人在項目中發揮最大的效能。有效的分工可以提高生產力和效率，同時確保任務的高質量完成。"
                },
                {
                    "id": "9",
                    "Question": "今天會議需要討論的題目有: 1.期末專題主題 2. 分工 3. 時程規劃，請幫我安排會議大綱和時長",
                    "Answer": "以下是一個可能的會議大綱和時長安排，以討論期末專題主題、分工和時程規劃：會議主題：期末專題討論預計時長：60 分鐘歡迎和開場白（5 分鐘）主持人介紹會議目的和議程確認與會人員和確認時間安排期末專題主題討論（25 分鐘）各位成員分享對期末專題的想法和建議共同討論可能的主題和方向收集意見和進行初步討論分工討論（20 分鐘）討論如何分配工作和角色考慮成員的能力和興趣確定每個人的貢獻和責任時程規劃（10 分鐘）確定專題完成的最後期限分配時間給每個階段的任務和活動討論和解決可能的時間衝突總結和下一步行動（5 分鐘）主持人總結會議內容和討論結果確認下一步行動項目和負責人提醒成員關注相關通訊和進一步討論請注意，以上時長僅為參考，根據實際情況和討論深度，您可以根據需要進行調整。確保會議在預定時間內進行，並給予每個議題足夠的討論時間，同時保持議程的流暢和效率。"
                },
                {
                    "id": "10",
                    "Question": "我們小組內部吵架了，作為主持人請幫忙打圓場",
                    "Answer": "當小組內部出現吵架時，作為主持人，您可以嘗試以下方法來打圓場和解決衝突：保持冷靜：作為主持人，保持冷靜和客觀是至關重要的。不要被情緒所左右，並確保以冷靜的態度處理衝突。創造安全的環境：確保會議環境是安全和尊重的，讓每個人都有發言的機會，並能夠自由表達觀點，而不會受到指責或攻擊。听取各方观点：讓每位團隊成員依次表達他們的觀點，並傾聽他們的意見。確保每個人都有被聽取和理解的感覺。引導對話：引導對話，以促進理解和溝通。鼓勵團隊成員以事實為基礎，而非情感為依據，進行討論。找出共同點：尋找團隊成員之間的共同點和共識，並強調彼此的共同目標。這有助於將注意力從分歧轉移到合作上。提供解決方案：作為主持人，您可以提供建議或提出解決方案，以幫助解決衝突。確保解決方案是公平和平衡的，有助於滿足各方的需求和利益。促進妥協和合作：鼓勵各方尋求妥協和合作的方式，以達到共同的目標。提醒他們合作解決問題比爭執更有建設性和長遠的效益。跟進和總結：確保衝突得到解決後的跟進，並總結會議的結果和決策。這有助於確保團隊成員對解決方案感到滿意並能夠向前邁進。衝突是不可避免的，但是通過有效的溝通和解決衝突的方法，您可以幫助小組重建合作關係並向共同目標邁進。"
                }
            ];
        }
    },
    delimiters: ['[[', ']]']
}).mount('#app');

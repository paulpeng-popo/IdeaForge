import os
import sys
import base64

from flask_cors import CORS
from toolspack.crossAPI import TTSCrossLanguage
# from toolspack.recogAPI import ASRChineseAPI
from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AudioPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio")

# mkdir audio
if not os.path.exists(AudioPath):
    os.mkdir(AudioPath)

app = Flask(__name__)
app.config["CORS_HEADERS"] = "Content-Type"
app.config["SECRET_KEY"] = os.urandom(24)
CORS(app, resources={r"/*": {"origins": "*"}})

socketio = SocketIO(app)
socketio = SocketIO(app, cors_allowed_origins="*")

app.template_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
app.static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


@app.route("/", methods=["GET"])
def home():
     return render_template("index.html")


@app.route("/api/room/<roomId>", methods=["GET"])
def api_room(roomId):
    
    if roomId not in socketio.server.manager.rooms:
        socketio.server.manager.rooms[roomId] = {}
        socketio.server.manager.rooms[roomId]["users"] = {}
        socketio.server.manager.rooms[roomId]["data"] = list()
        return jsonify({"status": "true", "roomId": roomId})
    else:   
        return jsonify({"status": "false", "roomId": roomId})


@app.route("/room/<roomId>", methods=["GET"])
def room(roomId):
    return render_template("room.html", roomId=roomId)


@socketio.on("join")
def join(data):
    roomId = data["roomId"]
    userName = data["userName"]
    server_data = socketio.server.manager.rooms[roomId]
    join_room(roomId)
    user_data = {
        "socket_id" : request.sid,
        "user_name" : userName
    }
    server_data["users"][request.sid] = user_data
    print("join", roomId, userName)
    emit("join", {"userName": userName}, room=roomId)





@socketio.on("get_users")
def get_users(data):
    roomId = data["roomId"]
    server_data = socketio.server.manager.rooms[roomId]
    users = server_data["users"]
    print("get_users", roomId, users)
    emit("get_users", {"users": users}, room=roomId)
    return users


@socketio.on("leave")
def leave(data):
    roomId = data["roomId"]
    userName = data["userName"]
    server_data = socketio.server.manager.rooms[roomId]
    leave_room(roomId)
    del server_data["users"][request.sid]
    print("leave", roomId, userName)
    emit("leave", {"userName": userName}, room=roomId)


@socketio.on("message")
def message(data):
    roomId = data["roomId"]
    userName = data["userName"]
    message = data["message"]
    print("message", roomId, userName, message)
    emit("message", {"userName": userName, "message": message}, room=roomId)


@socketio.on("audio")
def audio(data):
    roomId = data["roomId"]
    userName = data["userName"]
    audio = data["audio"]
    print("audio", roomId, userName, audio)
    emit("audio", {"userName": userName, "audio": audio}, room=roomId)


@socketio.on("disconnect")
def disconnect(data):
    roomId = data["roomId"]
    userName = data["userName"]
    server_data = socketio.server.manager.rooms[roomId]
    del server_data["users"][request.sid]
    print("disconnect", roomId, userName)
    emit("disconnect", {"userName": userName}, room=roomId)


@app.route("/say", methods=["POST"])
def api():
    text = request.form.get("text")
    
    if len(text) > 20:
        result = {
            "status": "false",
            "data": "text too long",
        }
        return jsonify(result)

    tts_client = TTSCrossLanguage(AudioPath)
    tts_client.set_language(language="zh", speaker="UDN")
    tts_client.askForService(text)

    filename = os.path.join(AudioPath, "output.wav")
    with open(filename, "rb") as audio:
        audio_b64 = base64.b64encode(audio.read())

    result = {
        "status": "true",
        "data": audio_b64.decode("utf-8"),
    }
    
    return jsonify(result)


# @app.route("/recog", methods=["POST"])
# def recog():
#     audio_blob = request.data
#     recog_client = ASRChineseAPI(audio_blob, AudioPath)
#     recog_client.recognize()
#     text = recog_client.get_text()
#     return jsonify(text=text)


if __name__ == "__main__":
    HOST = "0.0.0.0"
    PORT = 6093
    socketio.run(app, host=HOST, port=PORT, debug=True)

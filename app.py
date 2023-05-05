import flask

from flask import Flask, request, jsonify,render_template

app = Flask(__name__)

@app.route('/', methods=['GET'])
def home():
     return render_template("index.html")

@app.route('/api', methods=['GET'])
def api():
    return jsonify({'message': 'Hello, World!'})

@app.route('/api/sum', methods=['GET'])
def sum():
    a = request.args.get('a')
    b = request.args.get('b')
    return jsonify({'sum': int(a) + int(b)})

if __name__ == '__main__':
    app.run(debug=True)

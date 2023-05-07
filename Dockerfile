FROM python:3.9

WORKDIR /ideaforge
COPY . .

RUN apt update && apt install -y python3-pip
RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt
RUN apt install -y vim wget curl git tar
RUN apt install -y tmux screen

CMD ["python3", "app.py"]

# sudo docker build -t ideaforge:v1 .
# sudo docker run -itd -p 6093:6093 -v /home/mi2s/IdeaForge:/ideaforge --restart=always --name ideaforge_demo ideaforge:v1

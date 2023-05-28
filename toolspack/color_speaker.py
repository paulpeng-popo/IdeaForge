RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
PURPLE = "\033[35m"
CYAN = "\033[36m"
WHITE = "\033[37m"
RESET = "\033[0m"


def say(text):
    print(f"{GREEN}{text}{RESET}")


def error(text):
    print(f"{RED}{text}{RESET}")


def warn(text):
    print(f"{YELLOW}{text}{RESET}")


def info(text):
    print(f"{BLUE}{text}{RESET}")


def debug(text):
    print(f"{PURPLE}{text}{RESET}")


def trace(text):
    print(f"{CYAN}{text}{RESET}")


def log(text):
    print(f"{WHITE}{text}{RESET}")

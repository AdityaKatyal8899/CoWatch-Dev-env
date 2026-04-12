from passlib.context import CryptContext

pass_context = CryptContext(schemes=['bcrypt'], deprecated='auto')

class Hash():
    
    def bcrypt(password: str):
        return pass_context.hash(password)
    
    def verify(request_pass: str, hashed_pass: str):
        return pass_context.verify(request_pass, hashed_pass)

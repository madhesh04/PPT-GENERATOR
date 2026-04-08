import bcrypt

def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(
        password=plain_password.encode('utf-8'),
        hashed_password=hashed_password.encode('utf-8')
    )

def get_password_hash(password: str):
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password=pwd_bytes, salt=salt)
    return hashed_password.decode('utf-8')

test_pwd = "password123"
hashed = get_password_hash(test_pwd)
print(f"Hashed: {hashed}")
verified = verify_password(test_pwd, hashed)
print(f"Verified: {verified}")

if verified:
    print("LOGIC_CONFIRMED")
else:
    print("LOGIC_FAILED")

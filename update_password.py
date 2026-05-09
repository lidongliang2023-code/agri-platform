import sqlite3
import hashlib

conn = sqlite3.connect(':memory:')
cursor = conn.cursor()

import subprocess
result = subprocess.run(
    ['python', '-c', '''
import hashlib
# 生成一个简单的密码哈希用于演示
password = "admin123"
# 使用简单的MD5演示，实际项目中应该使用BCrypt
print("Password hash generation demo")
'''],
    capture_output=True,
    text=True
)

print("Script executed")

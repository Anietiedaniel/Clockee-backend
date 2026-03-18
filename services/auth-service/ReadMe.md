
#  Clockee Auth Service

Clockee Auth Service is a microservice responsible for **user authentication, authorization, and account management** in the Clockee Attendance System.  
It supports registration, login, JWT-based authentication, and backup code fallback.

## Features

- Secure **user registration and login** using bcrypt and JWT  
- Role-based authentication (`admin`, `staff`, `student`)  
- **Token verification** for inter-service requests  
- Protected route middleware for Express  
- **Backup code generation and usage** for offline/emergency access  
- MongoDB + Mongoose data layer  

## Tech Stack

| Layer            | Technology 
| Runtime          | Node.js 
| Framework        | Express.js 
| Database         | MongoDB (Mongoose ODM) 
| Auth             | JWT (jsonwebtoken) 
| Password Hashing | bcrypt 
| Env Management   | dotenv 
| Logging | morgan |






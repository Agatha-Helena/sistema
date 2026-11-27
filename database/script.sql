CREATE DATABASE IF NOT EXISTS db_fisiomais;
USE db_fisiomais;

CREATE TABLE IF NOT EXISTS usuarios(
	id INT AUTO_INCREMENT PRIMARY KEY,
	nome VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    senha VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS pacientes (
	id_paciente INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(200) NOT NULL,
    telefone VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS tratamentos (
	id_tratamento INT AUTO_INCREMENT PRIMARY KEY,
    id_paciente INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    preco FLOAT (10, 2) NOT NULL,
    FOREIGN KEY(id_paciente) REFERENCES pacientes (id_paciente)
);

CREATE TABLE IF NOT EXISTS agendamentos (
	id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
    id_tratamento INT NOT NULL UNIQUE,
    data_agendamento DATETIME NOT NULL,
    FOREIGN KEY(id_tratamento) REFERENCES tratamentos(id_tratamento)
);

INSERT INTO usuarios(nome, email, senha) VALUES 
('Admin', 'admin@fisiomais.com', '$2b$10$2jkJE0ZUkCIROq96XiDyOeNc4RcrlGynzHXAH5W1ePNfF6SSN1zma'),
('Admin2', 'admin2@fisiomais.com', '$2b$10$uVnkInrk3fXhdUfdQh4BHOG9acoOEZ0fS7eELCscfj1KwbWA2qff6'),
('Admin3', 'admin3@fisiomais.com', '$2b$10$AxaNEzu0XoEyRqP1U4KI1uZU8MShPxNKWdZNivcei0cIe6GMZ1m5C');

INSERT INTO pacientes(nome, cpf, email, telefone) VALUES
('Ana', '7e9bf0bdd7ba4923b68244dbf142752a', 'ana@email.com', '(11)99999-9999'),
('Maria', 'f1cc8b6c1635ff4681e8dac154814678', 'maria@email.com', '(11)99999-9998'),
('Braga', '68d14208475a4e6e91567af9d23d37d8', 'braga@email.com', '(11)99999-9997');

INSERT INTO tratamentos(nome, preco, id_paciente) VALUES 
('Tratamento 1', 25.00, 1), 
('Tratamento 2', 37.00, 2), 
('Tratamento 3', 100, 3);

INSERT INTO agendamentos(id_tratamento, data_agendamento) VALUES 
(1, '2026-11-05 09:00:00'), 
(2, '2026-11-05 09:30:00'),
(3, '2026-11-05 10:00:00');
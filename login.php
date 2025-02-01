<?php
session_start();

// Connexion à la base de données
$host = "localhost"; 
$dbname = "unware_studio";
$username = "root";
$password = ""; 

$conn = new mysqli($host, $username, $password, $dbname);

// Vérifier la connexion
if ($conn->connect_error) {
    die("Échec de la connexion à la base de données : " . $conn->connect_error);
}

$message = "";

// Vérifier si le formulaire a été soumis
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $email = trim($_POST["email"]);
    $password = trim($_POST["password"]);

    // Requête SQL pour vérifier si l'email existe
    $sql = "SELECT id, email, password FROM users WHERE email = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();
    $stmt->bind_result($id, $user_email, $hashed_password);
    $stmt->fetch();

    if ($stmt->num_rows > 0 && password_verify($password, $hashed_password)) {
        // Création de la session utilisateur
        $_SESSION["user_id"] = $id;
        $_SESSION["email"] = $user_email;

        // Redirection vers la page de profil
        header("Location: profil.php");
        exit();
    } else {
        $message = "<p class='message error-message'>Identifiants incorrects !</p>";
    }

    $stmt->close();
}

$conn->close();
?>


<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Connexion</title>
    <style>
        /* Global Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            background-color: #2d2d2d;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            text-align: center;
            color: white;
        }
        .container {
            background-color: #1e1e1e;
            padding: 40px 35px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            width: 100%;
            max-width: 400px;
            margin: 20px;
        }
        h1 {
            color: #fff;
            margin-bottom: 25px;
            font-size: 2rem;
        }
        label {
            font-size: 1rem;
            margin-bottom: 10px;
            color: #ccc;
            text-align: left;
            display: block;
        }
        input {
            width: 100%;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
            border: 1px solid #444;
            background-color: #333;
            color: #fff;
            font-size: 1rem;
            transition: border-color 0.3s ease;
        }
        input:focus {
            outline: none;
            border-color: #1d4ed8;
        }
        button {
            width: 100%;
            padding: 15px;
            background-color: #1d4ed8;
            border: none;
            border-radius: 8px;
            color: white;
            font-size: 1.1rem;
            cursor: pointer;
            transition: background-color 0.3s ease;
        }
        button:hover {
            background-color: #2563eb;
        }
        .message {
            font-size: 1.1rem;
            margin-top: 20px;
        }
        .error-message {
            color: #f87171;
        }
        .register-btn {
            margin-top: 20px;
            color: #10b981;
            font-weight: bold;
            text-decoration: none;
            font-size: 1rem;
            display: inline-block;
            transition: color 0.3s ease;
        }
        .register-btn:hover {
            color: #34d399;
        }

        /* Mobile responsiveness */
        @media (max-width: 600px) {
            .container {
                width: 90%;
                padding: 30px;
            }
            h1 {
                font-size: 1.8rem;
            }
            button {
                font-size: 1rem;
            }
        }
    </style>
</head>
<body>

    <div class="container">
        <h1>Connexion</h1>
        <form action="" method="POST">
            <div class="form-group">
                <label for="email">Adresse email :</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">Mot de passe :</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Se connecter</button>
        </form>
        
        <?php if (!empty($message)) echo $message; ?>

        <p>Vous n'avez pas encore de compte ? <a href="register.php" class="register-btn">S'inscrire</a></p>
    </div>

</body>
</html>

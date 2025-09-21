<?php
session_start();
$key = getenv('SECRET_KEY') ?: 'default_secret_key';
function encryptMultipleTimes($data,$key,$rounds=500){
    $encrypted=$data;
    for($i=0;$i<$rounds;$i++){
        $iv=random_bytes(16);
        $encrypted=base64_encode($iv . openssl_encrypt($encrypted,'aes-256-cbc',$key,OPENSSL_RAW_DATA,$iv));
    }
    return $encrypted;
}
function decryptMultipleTimes($data,$key,$rounds=500){
    $decrypted=$data;
    for($i=0;$i<$rounds;$i++){
        $decoded=base64_decode($decrypted);
        $iv=substr($decoded,0,16);
        $ciphertext=substr($decoded,16);
        $decrypted=openssl_decrypt($ciphertext,'aes-256-cbc',$key,OPENSSL_RAW_DATA,$iv);
    }
    return $decrypted;
}
$usersFile='users.json';
if(!file_exists($usersFile)) file_put_contents($usersFile,json_encode([]));
$users=json_decode(file_get_contents($usersFile),true);
$action = $_POST['action'] ?? $_GET['action'] ?? '';
if($action==='register'){
    $username=$_POST['username']??'';
    $password=$_POST['password']??'';
    if(isset($users[$username])){
        echo json_encode(['success'=>false,'message'=>'Пользователь уже существует!']);
    } else {
        $users[$username]=encryptMultipleTimes($password,$key,500);
        file_put_contents($usersFile,json_encode($users));
        echo json_encode(['success'=>true,'message'=>'Регистрация успешна!']);
    }
    exit;
}
if($action==='login'){
    $username=$_POST['username']??'';
    $password=$_POST['password']??'';
    if(isset($users[$username]) && decryptMultipleTimes($users[$username],$key,500)===$password){
        $_SESSION['user']=$username;
        echo json_encode(['success'=>true,'message'=>'Вход выполнен!']);
    } else echo json_encode(['success'=>false,'message'=>'Неверный логин или пароль!']);
    exit;
}
if($action==='logout'){
    session_destroy();
    echo json

import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'
import { BrowserRouter as Router, Routes, Route, Link } from "react-router";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import Users from "./pages/Users.jsx";
import { Container } from 'react-bootstrap'


function App() {

  const pages= {
    home: "/",
    about: "/about",
    users: "/users",
  };


  const [currentPage, setCurrentPage] = useState('home');
  
  function changeScreen(page) {
    setCurrentPage(page);
  }

  return (
    <Container>
      <Router>
        <h1> Router Demo</h1>
        <ul>
          <li>
            <Link to={pages.home} onClick={() => changeScreen("home")}>Home</Link>
          </li>
          <li>
            <Link to={pages.about} onClick={() => changeScreen("about")}>About</Link>
          </li>
          <li>
            <Link to={pages.users} onClick={() => changeScreen("users")}>Users</Link>
          </li>
        </ul>
        <Routes>
          <Route path={pages.home} element={<Home pages={pages} changePage={changeScreen} />} />
          <Route path={pages.about} element={<About pages={pages} changePage={changeScreen} />} />
          <Route path={pages.users} element={<Users pages={pages} changePage={changeScreen} />} />
          
        </Routes>
      </Router>
      <p>In {currentPage}</p>
    </Container>
  );


} 

export default App;
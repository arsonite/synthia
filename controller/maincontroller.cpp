#include "maincontroller.h"

MainController::MainController(): lg(Logger("MainController"))
{

}

MainController::~MainController()
{

}

void MainController::keyPressed(QKeyEvent *e)
{
    lg.log("Pressed: " + e->text());
}


void MainController::KeyReleased(QKeyEvent *e)
{
    lg.log("Released: " + e->text());
}

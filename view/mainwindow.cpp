#include "mainwindow.h"
#include "ui_mainwindow.h"

#include <QStandardPaths>
MainWindow::MainWindow(QWidget *parent):
    QMainWindow(parent),
    ui_(new Ui::MainWindow),
    lg(Logger("MainWindow"))
{
    setWindowTitle("synthia");
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

    ui_->setupUi(this);

    ui_->view->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    ui_->view->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    ui_->view->setAlignment(Qt::AlignTop | Qt::AlignLeft);
    ui_->view->setStyleSheet(QString("border: none; background-color: #%1;").arg("353535"));

    ui_->central->setStyleSheet(QString("background-color: #%1;").arg("353535"));

    ui_->menubar->setStyleSheet(QString("border-bottom: 2px solid #222; color: #fff; background-color: #%1;").arg("353535"));

    lg.log("Started up MainWindow with Application-Path: " + QString(getenv("APPDATA")));
}

MainWindow::~MainWindow()
{
    delete ui_;
    delete controller_;
}

void MainWindow::setController(MainController *mC)
{
    controller_ = mC;
}

void MainWindow::keyPressEvent(QKeyEvent *e)
{
    controller_->keyPressed(e);
}

void MainWindow::keyReleaseEvent(QKeyEvent *e)
{
    controller_->KeyReleased(e);
}

void MainWindow::mousePressEvent(QMouseEvent *e)
{
    pos_ = e->globalPos();
}

void MainWindow::mouseMoveEvent(QMouseEvent *e)
{
    const QPoint delta = e->globalPos() - pos_;
    move(x()+delta.x(), y()+delta.y());
    pos_ = e->globalPos();
}

void MainWindow::on_minimize_clicked()
{
    setWindowState(Qt::WindowState::WindowMinimized);
}

void MainWindow::on_maximize_clicked()
{
    if(!maximized_) {
        setWindowState(Qt::WindowState::WindowMaximized);
        maximized_ = true;
        return;
    }
    setWindowState(Qt::WindowState::WindowNoState);
    maximized_ = false;
}

void MainWindow::on_close_clicked()
{
    close();
}

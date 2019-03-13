#include "mainwindow.h"
#include "ui_mainwindow.h"

#include <QStandardPaths>

MainWindow::MainWindow(QWidget *parent):
    QMainWindow(parent),
    ui_(new Ui::MainWindow),
    lg(Logger("MainWindow"))
{

    const int width = size().width();
    const int height = size().height();

    setWindowTitle("synthia");
    //setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

    ui_->setupUi(this);
    ui_->view->setVerticalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    ui_->view->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    ui_->view->resize(width, height);
    ui_->view->setSceneRect(0, 0, width, height);
    ui_->view->setAlignment(Qt::AlignTop | Qt::AlignLeft);

    QGraphicsScene *scene = new QGraphicsScene();
    scene->setBackgroundBrush(QBrush(QColor(35, 35, 35)));
    ui_->view->setScene(scene);

    QWidget *titleBar = new QWidget(this);

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

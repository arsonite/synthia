#include "mainwindow.h"
#include "ui_mainwindow.h"

#include <QStandardPaths>

MainWindow::MainWindow(QWidget *parent):
    QMainWindow(parent),
    ui_(new Ui::MainWindow),
    lg(Logger("MainWindow"))
{
    ui_->setupUi(this);

    lg.log("Started up MainWindow with Application-Path: " + QString(getenv("APPDATA")));
}

MainWindow::~MainWindow()
{
    delete ui_;
}

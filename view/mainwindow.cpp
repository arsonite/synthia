#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "view/clickableqlabel.h"

#include <QSizeGrip>
#include <QStandardPaths>
#include <QMimeData>
#include <QDirIterator>
#include <QStringList>

MainWindow::MainWindow(QWidget *parent):
    QMainWindow(parent),
    ui_(new Ui::MainWindow),
    lg(Logger("MainWindow"))
{
    player_ = new QMediaPlayer(this);

    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);
    setAcceptDrops(true);

    ui_->setupUi(this);

    ui_->list->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
    ui_->list->setStyleSheet(QString("color: #fff; border: none; background-color: #%1;").arg("353535"));

    ui_->central->setStyleSheet(QString("background-color: #%1;").arg("353535"));

    ui_->menubar->setStyleSheet(QString("color: #fff; background-color: #%1;").arg("444"));

    QSizeGrip *g = new QSizeGrip(this);

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

void MainWindow::dragEnterEvent(QDragEnterEvent *e)
{
    if (e->mimeData()->hasUrls()) {
        e->acceptProposedAction();
    }
}

void MainWindow::dropEvent(QDropEvent *e)
{
    QString soundExt[2] = {"wav", "mp3"};
    QString imgExt[3] = {"jpg", "jpeg", "png"};

    QList<QUrl> urls = e->mimeData()->urls();
    int count = urls.size();

    // TODO: Implement recursive tree traversal algorithm in case a folder gets dropped into window instead of multiple files or singular file
    if(count == 1 && !urls.first().toLocalFile().contains(soundExt[0]) && !urls.first().toLocalFile().contains(soundExt[1])) {
        QDirIterator it(urls.first().toLocalFile());
        while (it.hasNext()) {
           auto entry = it.next().replace(QRegExp(".*/"), "");
           QListWidgetItem *item = new QListWidgetItem(entry);
           item->setStatusTip(it.next());
           ui_->list->addItem(item);
        }
    } else {
        for(QUrl &url : urls) {
            QString fileName = url.toLocalFile();
            if(fileName.contains(".wav") || fileName.contains(".mp3")) {
                lg.log(fileName);
            }
        }
    }
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

void MainWindow::on_list_itemClicked(QListWidgetItem *item)
{
    player_->setMedia(QUrl::fromLocalFile(item->statusTip()));
    player_->setVolume(100);
    player_->play();
    lg.log("Now playing... " + item->text());
}
